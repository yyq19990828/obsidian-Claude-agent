import { App, FileSystemAdapter } from "obsidian";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import process from "process";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ContextService } from "./context";
import { createVaultMcpServer } from "./vault-tools";
import type { ClaudeAgentSettings, ToolCall, SdkToolToggles } from "../types";

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
			filePath: typeof input.path === "string" ? input.path : undefined,
		});
	}
	return calls;
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
	private vaultServer;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => ClaudeAgentSettings,
		private readonly requestToolApproval: (toolCall: ToolCall) => Promise<boolean>
	) {
		this.vaultServer = createVaultMcpServer(
			app,
			() => this.getSettings().confirmFileOperations,
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
		const tools: string[] = ["mcp__obsidian-vault__*"];
		if (!settings.safeMode) {
			for (const [name, enabled] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, boolean][]) {
				if (enabled) {
					tools.push(name);
				}
			}
		}
		return tools;
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

			const options = {
				cwd,
				model: settings.model,
				includePartialMessages: true,
				resume: sessionId,
				abortController,
				env,
				mcpServers: {
					"obsidian-vault": this.vaultServer,
				},
				allowedTools: this.buildAllowedTools(settings),
				...(settingSources ? { settingSources } : {}),
				...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
			};

			const stream = query({
				prompt,
				options,
			});

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
					for (const toolCall of toolCalls) {
						yield {
							type: "tool_executed",
							toolCall: {
								...toolCall,
								status: "executed",
								result: "Tool call completed.",
							},
						};
					}

					yield {
						type: "assistant_complete",
						content: extractAssistantText(message),
						toolCalls,
					};
					continue;
				}

				if (message.type === "result") {
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
