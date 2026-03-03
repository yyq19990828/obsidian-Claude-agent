import { App, FileSystemAdapter } from "obsidian";
import { query, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import process from "process";
import { ContextService } from "./context";
import { buildVaultMcpServer } from "./vault-tools";
import { loadFileAgents } from "./agent-loader";
import { extractAssistantText, extractToolCalls, extractToolResults, extractTextDelta, extractThinkingDelta } from "./message-extractor";
import { resolveClaudeExecutablePath } from "./executable-resolver";
import { buildAllowedTools, buildDisallowedTools, buildAvailableTools } from "./tool-permission";
import { buildSdkOptions } from "./sdk-options-builder";
import type { EventBus } from "../state/event-bus";
import type { ClaudeAgentSettings, ToolCall, ThinkingBlock, ToolPermission } from "../types";

function buildPrompt(userText: string, noteContext: Awaited<ReturnType<typeof ContextService.captureActiveNoteContext>>, maxSize: number): string {
	if (!noteContext) {
		return userText;
	}

	const truncationNote = noteContext.truncated
		? `\n[Note: content truncated to ${maxSize} characters]\n`
		: "\n";

	return `[Current note: ${noteContext.path}]\n${noteContext.content}${truncationNote}\n---\n\n${userText}`;
}

/**
 * Cached results from expensive build operations (filesystem reads, subprocess calls).
 * Invalidated when settings change (via `resetAllSessions` / `invalidateCache`).
 */
interface OptionsCache {
	agents: Record<string, AgentDefinition> | undefined;
	vaultServer: ReturnType<typeof buildVaultMcpServer> | null;
	allowedTools: string[];
	disallowedTools: string[];
	availableTools: string[] | undefined;
	claudeExecutablePath: string | undefined;
}

export class AgentService {
	private activeAbortControllers = new Map<string, AbortController>();
	private sessions = new Map<string, string>();
	/** Cached build results; null means cache is invalid and must be rebuilt. */
	private _optionsCache: OptionsCache | null = null;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => ClaudeAgentSettings,
		private readonly requestToolApproval: (toolCall: ToolCall) => Promise<boolean>,
		private readonly pluginDir?: string,
		private readonly eventBus?: EventBus,
	) {}

	/** Invalidate cached build results so they are rebuilt on next message. */
	invalidateCache(): void {
		this._optionsCache = null;
	}

	private getOrBuildCache(settings: ClaudeAgentSettings): OptionsCache {
		if (this._optionsCache) return this._optionsCache;

		this._optionsCache = {
			agents: this.buildAgents(settings),
			vaultServer: this.buildVaultServer(settings),
			allowedTools: buildAllowedTools(settings),
			disallowedTools: buildDisallowedTools(settings),
			availableTools: buildAvailableTools(settings),
			claudeExecutablePath: settings.authMethod === "claude_code"
				? resolveClaudeExecutablePath(settings)
				: undefined,
		};
		return this._optionsCache;
	}

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
		this.invalidateCache();
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

	// eslint-disable-next-line no-undef
	async *sendMessage(tabId: string, userText: string): AsyncGenerator<Record<string, unknown>> {
		const settings = this.getSettings();
		const context = await ContextService.captureActiveNoteContext(this.app, settings.maxContextSize);
		const prompt = buildPrompt(userText, context, settings.maxContextSize);
		const cwd = this.getVaultCwd();
		const cache = this.getOrBuildCache(settings);

		if (settings.authMethod === "claude_code" && !cache.claudeExecutablePath) {
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
			const sessionId = this.sessions.get(tabId);
			const options = buildSdkOptions(
				settings,
				cache,
				cwd,
				sessionId,
				abortController,
				this.requestToolApproval,
			);

			const stream = query({
				prompt,
				options,
			});

			/* Pending tool calls from the most recent assistant message,
			   waiting for the user message that contains tool_result blocks. */
			let pendingToolCalls: ToolCall[] = [];
			let pendingAssistantText = "";

			/* Accumulate thinking tokens into ThinkingBlock objects for persistence */
			const allThinkingBlocks: ThinkingBlock[] = [];
			let currentThinkingBuffer = "";
			let isThinking = false;

			for await (const message of stream) {
				if (message.type === "system" && message.subtype === "init") {
					this.sessions.set(tabId, message.session_id);
					continue;
				}

				const thinkingDelta = extractThinkingDelta(message);
				if (thinkingDelta) {
					if (!isThinking) {
						isThinking = true;
						currentThinkingBuffer = "";
					}
					currentThinkingBuffer += thinkingDelta;
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
					/* Finalize any in-progress thinking block */
					if (isThinking && currentThinkingBuffer) {
						allThinkingBlocks.push({ thinking: currentThinkingBuffer, collapsed: true });
						currentThinkingBuffer = "";
						isThinking = false;
					}

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
						pendingToolCalls = toolCalls;
						pendingAssistantText = assistantText;
					} else {
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
								thinkingBlocks: allThinkingBlocks.length > 0 ? [...allThinkingBlocks] : [],
							};
							pendingToolCalls = [];
							pendingAssistantText = "";
						}

						yield {
							type: "assistant_complete",
							content: assistantText,
							toolCalls: [],
							thinkingBlocks: allThinkingBlocks.length > 0 ? [...allThinkingBlocks] : [],
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
					thinkingBlocks: allThinkingBlocks.length > 0 ? [...allThinkingBlocks] : [],
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
						thinkingBlocks: allThinkingBlocks.length > 0 ? [...allThinkingBlocks] : [],
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
			const sessionExpired = /session.*(expired|not found|invalid)|invalid.*session/i.test(message);

			if (sessionExpired && this.sessions.has(tabId)) {
				/* Session expired — clear and emit event */
				this.sessions.delete(tabId);
				this.eventBus?.emit("session:expired", { tabId });

				/* Auto-retry once without resume */
				try {
					yield* this.sendMessage(tabId, userText);
					this.eventBus?.emit("session:resumed", { tabId });
					return;
				} catch (retryError) {
					const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
					yield {
						type: "result",
						success: false,
						error: `Session recovery failed: ${retryMsg}`,
					};
				}
			} else {
				yield {
					type: "result",
					success: false,
					error: invalidAuth
						? "Authentication failed. Please verify your API key in Claude Agent settings or switch to Claude Code subscription mode."
						: message,
				};
			}
		} finally {
			this.activeAbortControllers.delete(tabId);
		}
	}
}
