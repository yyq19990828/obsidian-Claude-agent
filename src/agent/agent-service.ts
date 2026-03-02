import { App, FileSystemAdapter } from "obsidian";
import { query, type SDKMessage, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import process from "process";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ContextService } from "./context";
import { buildVaultMcpServer } from "./vault-tools";
import { loadFileAgents } from "./agent-loader";
import type { ClaudeAgentSettings, ToolCall, SdkToolToggles, ToolPermission } from "../types";
import { PERMISSION_FREE_TOOLS } from "../constants";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function buildPrompt(userText: string, noteContext: Awaited<ReturnType<typeof ContextService.captureActiveNoteContext>>, maxSize: number): string {
	if (!noteContext) {
		return userText;
	}

	const truncationNote = noteContext.truncated
		? `\n[Note: content truncated to ${maxSize} characters]\n`
		: "\n";

	return `[Current note: ${noteContext.path}]\n${noteContext.content}${truncationNote}\n---\n\n${userText}`;
}

function extractAssistantText(message: SDKMessage): string {
	if (message.type !== "assistant") {
		return "";
	}

	const content = isRecord(message.message) ? message.message.content : undefined;
	if (!Array.isArray(content)) {
		return "";
	}

	const blocks = content as Array<{ type?: unknown; text?: unknown }>;
	const textBlocks = blocks
		.filter((block) => block.type === "text")
		.map((block) => (typeof block.text === "string" ? block.text : ""));
	return textBlocks.join("\n").trim();
}

function extractToolCalls(message: SDKMessage): ToolCall[] {
	if (message.type !== "assistant") {
		return [];
	}

	const calls: ToolCall[] = [];
	const content = isRecord(message.message) ? message.message.content : undefined;
	if (!Array.isArray(content)) {
		return calls;
	}

	for (const block of content) {
		if (!isRecord(block) || block.type !== "tool_use") {
			continue;
		}

		const input = isRecord(block.input) ? block.input : {};
		const id = typeof block.id === "string" ? block.id : crypto.randomUUID();
		const toolName = typeof block.name === "string" ? block.name : "unknown_tool";
		calls.push({
			id,
			toolName,
			input,
			status: "pending",
			filePath: typeof input.path === "string" ? input.path : (typeof input.file_path === "string" ? input.file_path : undefined),
		});
	}
	return calls;
}

/**
 * Extract tool results from a `user` message that contains tool_result blocks.
 * The SDK sends these after executing tools, mapping tool_use_id → result content.
 */
function extractToolResults(message: SDKMessage): Map<string, string> {
	const results = new Map<string, string>();
	if (message.type !== "user") {
		return results;
	}

	const content = isRecord(message.message) ? message.message.content : undefined;
	if (!Array.isArray(content)) {
		return results;
	}

	for (const block of content) {
		if (!isRecord(block) || block.type !== "tool_result") {
			continue;
		}

		const toolUseId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
		if (!toolUseId) continue;

		/* content can be a string or an array of content blocks */
		let resultText: string;
		if (typeof block.content === "string") {
			resultText = block.content;
		} else if (Array.isArray(block.content)) {
			const parts: string[] = [];
			for (const part of block.content) {
				if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
					parts.push(part.text);
				}
			}
			resultText = parts.join("\n");
		} else {
			resultText = "";
		}

		/* Truncate very long results for UI display */
		if (resultText.length > 2000) {
			resultText = resultText.slice(0, 2000) + "\n... (truncated)";
		}

		results.set(toolUseId, resultText);
	}
	return results;
}

function extractTextDelta(message: SDKMessage): string | null {
	if (message.type !== "stream_event") {
		return null;
	}

	const event = message.event as unknown;
	if (!isRecord(event)) {
		return null;
	}

	if (event.type === "content_block_delta" && isRecord(event.delta) && event.delta.type === "text_delta" && typeof event.delta.text === "string") {
		return event.delta.text;
	}
	return null;
}

function extractThinkingDelta(message: SDKMessage): string | null {
	if (message.type !== "stream_event") {
		return null;
	}

	const event = message.event as unknown;
	if (!isRecord(event)) {
		return null;
	}

	if (event.type === "content_block_delta" && isRecord(event.delta) && event.delta.type === "thinking_delta" && typeof event.delta.thinking === "string") {
		return event.delta.thinking;
	}
	return null;
}

export class AgentService {
	private activeAbortControllers = new Map<string, AbortController>();
	private sessions = new Map<string, string>();

	constructor(
		private readonly app: App,
		private readonly getSettings: () => ClaudeAgentSettings,
		private readonly requestToolApproval: (toolCall: ToolCall) => Promise<boolean>,
		private readonly pluginDir?: string,
	) {}

	private buildVaultServer(settings: ClaudeAgentSettings) {
		return buildVaultMcpServer(
			this.app,
			settings.vaultToolPermissions,
			(name) => {
				const perms = settings.vaultToolPermissions as unknown as Record<string, string>;
				return (perms[name] ?? "ask") as ToolPermission;
			},
			(toolCall) => this.requestToolApproval(toolCall)
		);
	}

	resetSession(tabId: string): void {
		this.sessions.delete(tabId);
	}

	resetAllSessions(): void {
		this.sessions.clear();
	}

	abortInFlight(tabId?: string): void {
		if (tabId) {
			const controller = this.activeAbortControllers.get(tabId);
			controller?.abort();
			this.activeAbortControllers.delete(tabId);
		} else {
			for (const controller of this.activeAbortControllers.values()) {
				controller.abort();
			}
			this.activeAbortControllers.clear();
		}
	}

	getSessionId(tabId: string): string | undefined {
		return this.sessions.get(tabId);
	}

	setSessionId(tabId: string, sessionId: string): void {
		this.sessions.set(tabId, sessionId);
	}

	private getVaultCwd(): string {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}

		throw new Error("Cannot resolve vault path for Claude Agent SDK. This plugin requires desktop file-system vault access.");
	}

	private resolveClaudeExecutablePath(): string | undefined {
		const settings = this.getSettings();
		if (settings.claudeCliPath && existsSync(settings.claudeCliPath)) {
			return settings.claudeCliPath;
		}

		const envPath = process.env.CLAUDE_CODE_PATH;
		if (envPath && existsSync(envPath)) {
			return envPath;
		}

		const envCandidates = (process.env.PATH ?? "")
			.split(path.delimiter)
			.filter(Boolean)
			.map((segment) => path.join(segment, "claude"));
		for (const candidate of envCandidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		const home = process.env.HOME ?? "";
		const commonCandidates = [
			home ? path.join(home, ".local/bin/claude") : "",
			"/usr/local/bin/claude",
			"/usr/bin/claude",
			"/opt/homebrew/bin/claude",
		].filter(Boolean);

		for (const candidate of commonCandidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		try {
			const resolved = execFileSync("which", ["claude"], { encoding: "utf8" }).trim();
			if (resolved && existsSync(resolved)) {
				return resolved;
			}
		} catch {
			// Fall back to SDK built-in executable resolution.
		}

		return undefined;
	}

	private buildAllowedTools(settings: ClaudeAgentSettings): string[] {
		const allowed: string[] = [];

		/* Vault MCP tools: both "allow" and "ask" must be in allowedTools.
		   With permissionMode "dontAsk", the SDK denies anything NOT listed here.
		   Actual permission enforcement (ask prompt) happens inside the MCP handler. */
		const vaultPerms = settings.vaultToolPermissions;
		const vaultToolMap: Record<string, string> = {
			write_note: "mcp__obsidian-vault__write_note",
			edit_note: "mcp__obsidian-vault__edit_note",
		};
		for (const [key, mcpName] of Object.entries(vaultToolMap)) {
			const perm = (vaultPerms as unknown as Record<string, ToolPermission>)[key] ?? "ask";
			if (perm === "allow" || perm === "ask") {
				allowed.push(mcpName);
			}
		}

		/* Permission-free SDK tools — always allowed */
		allowed.push(...PERMISSION_FREE_TOOLS);

		/* Permission-required SDK tools */
		if (!settings.safeMode) {
			for (const [name, perm] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, ToolPermission][]) {
				if (perm === "allow") {
					allowed.push(name);
				}
			}
		}
		return allowed;
	}

	private buildDisallowedTools(settings: ClaudeAgentSettings): string[] {
		const disallowed: string[] = [];

		/* Vault MCP tools: hide "deny" tools from the model entirely */
		const vaultPerms = settings.vaultToolPermissions;
		const vaultToolMap: Record<string, string> = {
			write_note: "mcp__obsidian-vault__write_note",
			edit_note: "mcp__obsidian-vault__edit_note",
		};
		for (const [key, mcpName] of Object.entries(vaultToolMap)) {
			const perm = (vaultPerms as unknown as Record<string, ToolPermission>)[key] ?? "ask";
			if (perm === "deny") {
				disallowed.push(mcpName);
			}
		}

		return disallowed;
	}

	private buildAvailableTools(settings: ClaudeAgentSettings): string[] | undefined {
		/* Permission-free tools are always available */
		const tools: string[] = [...PERMISSION_FREE_TOOLS];

		if (!settings.safeMode) {
			/* Super mode: add permission-required tools based on toggles */
			for (const [name, perm] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, ToolPermission][]) {
				if (perm === "allow" || perm === "ask") {
					tools.push(name);
				}
			}
		}
		return tools;
	}

	private buildPermissionMode(settings: ClaudeAgentSettings): "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" {
		if (settings.safeMode) {
			// Safe mode restricts available tools to vault MCP tools only.
			// Use "acceptEdits" so the agent can execute those tools;
			// access control is enforced by each vault tool's own allow/ask/deny permission.
			return "acceptEdits";
		}
		switch (settings.permissionMode) {
			case "auto_approve":
				return "bypassPermissions";
			case "plan_only":
				return "plan";
			default:
				/* "confirm" mode: use "acceptEdits" so file-write operations
				   are not blocked by the SDK's internal file-permission layer
				   (which requires CLI-interactive approval that can't work in
				   Obsidian).  Tool-level access control is handled by canUseTool
				   + allowedTools instead. */
				return "acceptEdits";
		}
	}

	private buildAgents(settings: ClaudeAgentSettings): Record<string, AgentDefinition> | undefined {
		if (settings.safeMode) return undefined;

		const agents: Record<string, AgentDefinition> = {};
		const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
		const vaultCwd = this.getVaultCwd();
		const pluginDir = this.pluginDir ?? `${vaultCwd}/.obsidian/plugins`;

		// 1. Load filesystem agents (three-layer merge, high overrides low)
		const fileAgents = loadFileAgents(
			homeDir,
			vaultCwd,
			pluginDir,
			settings.agentConfigSubdir,
			settings.configLayerToggles,
		);
		for (const fa of fileAgents) {
			const def: AgentDefinition = {
				description: fa.description,
				prompt: fa.prompt,
			};
			if (fa.model !== "inherit") def.model = fa.model;
			if (fa.tools.length > 0) def.tools = fa.tools;
			if (fa.maxTurns > 0) def.maxTurns = fa.maxTurns;
			agents[fa.name] = def;
		}

		// 2. Load UI built-in agents (enabled + name non-empty override filesystem)
		for (const sa of settings.subagents) {
			if (!sa.enabled || !sa.name.trim()) continue;
			const def: AgentDefinition = {
				description: sa.description,
				prompt: sa.prompt,
			};
			if (sa.model !== "inherit") def.model = sa.model;
			if (sa.tools.length > 0) def.tools = sa.tools;
			if (sa.maxTurns > 0) def.maxTurns = sa.maxTurns;
			agents[sa.name] = def;
		}

		return Object.keys(agents).length > 0 ? agents : undefined;
	}

	private buildSettingSources(settings: ClaudeAgentSettings): ("user" | "project" | "local")[] | undefined {
		if (settings.safeMode) {
			return undefined;
		}
		const sources: ("user" | "project" | "local")[] = [];
		const cs = settings.claudeSettingSources;
		if (cs.projectSettings || cs.projectMemory) {
			sources.push("project", "local");
		}
		if (cs.userSettings || cs.userMemory) {
			sources.push("user");
		}
		return sources.length > 0 ? sources : undefined;
	}

	async *sendMessage(tabId: string, userText: string) {
		const settings = this.getSettings();
		const context = await ContextService.captureActiveNoteContext(this.app, settings.maxContextSize);
		const prompt = buildPrompt(userText, context, settings.maxContextSize);
		const cwd = this.getVaultCwd();
		const pathToClaudeCodeExecutable = settings.authMethod === "claude_code" ? this.resolveClaudeExecutablePath() : undefined;

		if (settings.authMethod === "claude_code" && !pathToClaudeCodeExecutable) {
			yield {
				type: "result",
				success: false,
				error: "Claude code executable not found. Set environment variable CLAUDE_CODE_PATH or configure the path in settings.",
			};
			return;
		}

		const abortController = new AbortController();
		this.activeAbortControllers.set(tabId, abortController);

		try {
			const env: Record<string, string | undefined> = {
				...process.env,
				...settings.envVars,
			};

			if (settings.authMethod === "api_key" && settings.apiKey.trim()) {
				env.ANTHROPIC_API_KEY = settings.apiKey.trim();
			}

			const sessionId = this.sessions.get(tabId);
			const settingSources = this.buildSettingSources(settings);
			const availableTools = this.buildAvailableTools(settings);
			const permMode = this.buildPermissionMode(settings);
			const isBypass = permMode === "bypassPermissions";

			/* Build canUseTool callback — this is called by the SDK for any tool
			   NOT in allowedTools.  We need it for "confirm" mode so "ask" tools
			   trigger the approval UI, and everything else gets denied. */
			const askSdkTools = new Set<string>();
			if (!settings.safeMode && settings.permissionMode === "confirm") {
				for (const [name, perm] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, ToolPermission][]) {
					if (perm === "ask") {
						askSdkTools.add(name);
					}
				}
			}

			const needsCanUseTool = settings.permissionMode === "confirm" && !settings.safeMode;
			const canUseTool = needsCanUseTool
				? async (toolName: string, input: Record<string, unknown>) => {
					/* "ask" SDK tools → prompt the user */
					if (askSdkTools.has(toolName)) {
						const toolCall: ToolCall = {
							id: crypto.randomUUID(),
							toolName,
							input,
							status: "pending",
							filePath: typeof input.file_path === "string" ? input.file_path : (typeof input.path === "string" ? input.path : undefined),
						};
						const approved = await this.requestToolApproval(toolCall);
						return approved
							? { behavior: "allow" as const }
							: { behavior: "deny" as const, message: "User rejected tool call" };
					}
					/* Tools not explicitly configured → deny */
					return { behavior: "deny" as const, message: "Tool not permitted by current settings" };
				}
				: undefined;

			const disallowedTools = this.buildDisallowedTools(settings);
			const agents = this.buildAgents(settings);
			const vaultServer = this.buildVaultServer(settings);
			const mcpServers: Record<string, ReturnType<typeof buildVaultMcpServer> & object> = {};
			if (vaultServer) {
				mcpServers["obsidian-vault"] = vaultServer;
			}

			const options = {
				cwd,
				model: settings.model,
				includePartialMessages: true,
				resume: sessionId,
				abortController,
				env,
				mcpServers,
				allowedTools: this.buildAllowedTools(settings),
				...(disallowedTools.length > 0 ? { disallowedTools } : {}),
				...(availableTools !== undefined ? { tools: availableTools } : {}),
				permissionMode: permMode,
				...(isBypass ? { allowDangerouslySkipPermissions: true } : {}),
				...(canUseTool ? { canUseTool } : {}),
				...(settingSources ? { settingSources } : {}),
				...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
				...(agents ? { agents } : {}),
			};

			const stream = query({
				prompt,
				options,
			});

			/* Pending tool calls from the most recent assistant message,
			   waiting for the user message that contains tool_result blocks. */
			let pendingToolCalls: ToolCall[] = [];
			let pendingAssistantText = "";

			for await (const message of stream) {
				if (message.type === "system" && message.subtype === "init") {
					this.sessions.set(tabId, message.session_id);
					continue;
				}

				const thinkingDelta = extractThinkingDelta(message);
				if (thinkingDelta) {
					yield { type: "thinking_token", token: thinkingDelta };
					continue;
				}

				const delta = extractTextDelta(message);
				if (delta) {
					yield { type: "stream_token", token: delta };
					continue;
				}

				if (message.type === "tool_use_summary") {
					yield { type: "tool_summary", summary: message.summary };
					continue;
				}

				if (message.type === "assistant") {
					if (message.error) {
						yield {
							type: "result",
							success: false,
							error: `Assistant error: ${message.error}`,
						};
						continue;
					}

					const toolCalls = extractToolCalls(message);
					const assistantText = extractAssistantText(message);

					if (toolCalls.length > 0) {
						/* Store pending tool calls — actual results will arrive
						   in the subsequent `user` message with tool_result blocks. */
						pendingToolCalls = toolCalls;
						pendingAssistantText = assistantText;
					} else {
						/* No tool calls: flush any remaining pending and emit */
						if (pendingToolCalls.length > 0) {
							for (const tc of pendingToolCalls) {
								yield {
									type: "tool_executed",
									toolCall: { ...tc, status: "executed", result: tc.result ?? "" },
								};
							}
							yield {
								type: "assistant_complete",
								content: pendingAssistantText,
								toolCalls: pendingToolCalls,
							};
							pendingToolCalls = [];
							pendingAssistantText = "";
						}

						yield {
							type: "assistant_complete",
							content: assistantText,
							toolCalls: [],
						};
					}
					continue;
				}

				/* User message with tool_result blocks — match results to pending tool calls */
				if (message.type === "user" && pendingToolCalls.length > 0) {
					const resultsMap = extractToolResults(message);

					for (const tc of pendingToolCalls) {
						const result = resultsMap.get(tc.id) ?? "";
						yield {
							type: "tool_executed",
							toolCall: { ...tc, status: "executed", result },
						};
					}

					yield {
						type: "assistant_complete",
						content: pendingAssistantText,
						toolCalls: pendingToolCalls.map((tc) => ({
							...tc,
							status: "executed" as const,
							result: resultsMap.get(tc.id) ?? "",
						})),
					};
					pendingToolCalls = [];
					pendingAssistantText = "";
					continue;
				}

				if (message.type === "result") {
					/* Flush any remaining pending tool calls */
					if (pendingToolCalls.length > 0) {
						for (const tc of pendingToolCalls) {
							yield {
								type: "tool_executed",
								toolCall: { ...tc, status: "executed", result: tc.result ?? "" },
							};
						}
						yield {
							type: "assistant_complete",
							content: pendingAssistantText,
							toolCalls: pendingToolCalls,
						};
						pendingToolCalls = [];
						pendingAssistantText = "";
					}

					if (message.subtype === "success") {
						yield { type: "result", success: true, text: message.result };
					} else {
						yield {
							type: "result",
							success: false,
							error: message.errors.join("\n") || "Unknown SDK error",
						};
					}
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const invalidAuth = /auth|api key|authentication|401|forbidden/i.test(message);
			yield {
				type: "result",
				success: false,
				error: invalidAuth
					? "Authentication failed. Please verify your API key in Claude Agent settings or switch to Claude Code subscription mode."
					: message,
			};
		} finally {
			this.activeAbortControllers.delete(tabId);
		}
	}
}
