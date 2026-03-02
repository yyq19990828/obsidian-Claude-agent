import { App, FileSystemAdapter } from "obsidian";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import process from "process";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ContextService } from "./context";
import { createVaultMcpServer } from "./vault-tools";
import type { ClaudeAgentSettings, ToolCall, SdkToolToggles, ClaudeSettingSources } from "../types";

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

export class AgentService {
	private activeAbortController: AbortController | null = null;
	private sessionId?: string;
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

	resetSession(): void {
		this.sessionId = undefined;
	}

	abortInFlight(): void {
		this.activeAbortController?.abort();
		this.activeAbortController = null;
	}

	private getVaultCwd(): string {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}

		throw new Error("Cannot resolve vault path for Claude Agent SDK. This plugin requires desktop file-system vault access.");
	}

	private resolveClaudeExecutablePath(): string | undefined {
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
		if (settings.permissionMode === "super") {
			for (const [name, enabled] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, boolean][]) {
				if (enabled) {
					tools.push(name);
				}
			}
		}
		return tools;
	}

	private buildSettingSources(settings: ClaudeAgentSettings): ("user" | "project" | "local")[] | undefined {
		if (settings.permissionMode !== "super") {
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

	async *sendMessage(userText: string) {
		const settings = this.getSettings();
		const context = await ContextService.captureActiveNoteContext(this.app, settings.maxContextSize);
		const prompt = buildPrompt(userText, context, settings.maxContextSize);
		const cwd = this.getVaultCwd();
		const pathToClaudeCodeExecutable = settings.authMethod === "claude_code" ? this.resolveClaudeExecutablePath() : undefined;

		if (settings.authMethod === "claude_code" && !pathToClaudeCodeExecutable) {
			yield {
				type: "result",
				success: false,
				error: "Claude code executable not found. Set environment variable CLAUDE_CODE_PATH to your claude binary path (for example: ~/.local/bin/claude).",
			};
			return;
		}

		const abortController = new AbortController();
		this.activeAbortController = abortController;

		try {
			const env = settings.authMethod === "api_key" && settings.apiKey.trim()
				? { ...process.env, ANTHROPIC_API_KEY: settings.apiKey.trim() }
				: { ...process.env };

			const settingSources = this.buildSettingSources(settings);

			const options = {
				cwd,
				model: settings.model,
				includePartialMessages: true,
				resume: this.sessionId,
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
					this.sessionId = message.session_id;
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
			this.activeAbortController = null;
		}
	}
}
