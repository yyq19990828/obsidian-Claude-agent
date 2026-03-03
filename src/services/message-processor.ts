import type { AgentService } from "../agent/agent-service";
import type { ConversationStore } from "../state/conversation-store";
import type { TabManager } from "../state/tab-manager";
import type { EventBus } from "../state/event-bus";
import type { ChatView } from "../ui/chat-view";
import type { AgentEvent, ClaudeAgentSettings, ContentBlock, ToolCall, ThinkingBlock } from "../types";

export class MessageProcessor {
	private readonly loadingTabs = new Set<string>();
	private readonly queues = new Map<string, string[]>();

	constructor(
		private readonly agentService: AgentService,
		private readonly store: ConversationStore,
		private readonly tabManager: TabManager,
		private readonly eventBus: EventBus,
		private readonly getChatView: () => ChatView | null,
		private readonly getSettings: () => ClaudeAgentSettings,
		private readonly activateChatView: () => Promise<void>,
	) {}

	async enqueueOrRun(userText: string, tabId: string): Promise<void> {
		if (!userText.trim()) return;

		await this.activateChatView();

		if (this.loadingTabs.has(tabId)) {
			const q = this.queues.get(tabId) ?? [];
			q.push(userText);
			this.queues.set(tabId, q);
			this.getChatView()?.showQueue(q.length);
			return;
		}

		await this.processMessage(userText, tabId);
	}

	clearTabState(tabId: string): void {
		this.queues.delete(tabId);
		this.loadingTabs.delete(tabId);
	}

	isTabLoading(tabId: string): boolean {
		return this.loadingTabs.has(tabId);
	}

	private async processMessage(initialText: string, tabId: string): Promise<void> {
		const chatView = this.getChatView();
		if (!chatView) return;

		const settings = this.getSettings();
		if (settings.authMethod === "api_key" && !settings.apiKey.trim()) {
			chatView.showError("No auth configured. Add an API key in settings or switch to Claude Code subscription mode.");
			return;
		}

		const queue: string[] = [initialText];
		while (queue.length > 0) {
			const userText = queue.shift();
			if (!userText) continue;

			/* Store user message */
			this.store.addMessage(tabId, {
				role: "user",
				content: userText,
				timestamp: Date.now(),
			});

			await chatView.addUserMessage(userText, tabId);
			chatView.startAssistantMessage(userText, tabId);
			chatView.showLoading(true, tabId);
			this.loadingTabs.add(tabId);
			this.tabManager.setStatus(tabId, "streaming");

			const allContents: string[] = [];
			let finalToolCalls: ToolCall[] = [];
			let finalThinkingBlocks: ThinkingBlock[] = [];
			const contentBlocks: ContentBlock[] = [];

			for await (const rawEvent of this.agentService.sendMessage(tabId, userText)) {
				const event = rawEvent as AgentEvent;
				this.handleAgentEvent(event, tabId);
				if (event.type === "stream_token") {
					/* Accumulate into current text block */
					const last = contentBlocks[contentBlocks.length - 1];
					if (last && last.type === "text") {
						last.text += event.token;
					} else {
						contentBlocks.push({ type: "text", text: event.token });
					}
				} else if (event.type === "tool_executed") {
					contentBlocks.push({ type: "tool_call", toolCallId: event.toolCall.id });
				} else if (event.type === "assistant_complete") {
					if (event.content) {
						allContents.push(event.content);
					}
					finalToolCalls.push(...(event.toolCalls ?? []));
					finalThinkingBlocks = event.thinkingBlocks ?? [];
				}
			}

			const finalContent = allContents.join("\n\n");
			/* If the user switched tabs, activeAssistantBubble was already
			   cleared by restoreMessages → finishAssistantMessage will no-op.
			   showLoading is also safe to call unconditionally. */
			const currentView = this.getChatView();
			if (currentView) {
				await currentView.finishAssistantMessage(finalContent, finalToolCalls, tabId);
				currentView.showLoading(false, tabId);
			}
			this.loadingTabs.delete(tabId);
			this.tabManager.setStatus(tabId, "idle");

			/* Store assistant message */
			this.store.addMessage(tabId, {
				role: "assistant",
				content: finalContent,
				timestamp: Date.now(),
				toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
				thinkingBlocks: finalThinkingBlocks.length > 0 ? finalThinkingBlocks : undefined,
				contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
			});

			/* Auto-generate title from first exchange */
			const tab = this.store.getTab(tabId);
			if (tab && tab.messages.length === 2 && tab.title === "New conversation" && settings.autoGenerateTitle) {
				const title = initialText.slice(0, 50) + (initialText.length > 50 ? "..." : "");
				this.store.updateTitle(tabId, title);
			}

			/* Process queued messages */
			const pendingQueue = this.queues.get(tabId);
			if (pendingQueue && pendingQueue.length > 0) {
				queue.push(...pendingQueue.splice(0));
				chatView.showQueue(pendingQueue.length);
			}
		}
	}

	private handleAgentEvent(event: AgentEvent, tabId: string): void {
		const chatView = this.getChatView();
		if (!chatView) return;

		switch (event.type) {
			case "stream_token":
				chatView.appendAssistantToken(event.token, tabId);
				break;
			case "thinking_token":
				chatView.appendThinkingToken(event.token, tabId);
				this.eventBus.emit("agent:thinking-token", { tabId, token: event.token });
				break;
			case "assistant_complete":
				chatView.finishThinking(tabId);
				break;
			case "tool_summary":
				this.eventBus.emit("status:tool-active", { toolName: "agent", status: event.summary });
				break;
			case "tool_executed":
				chatView.addLiveToolCall(event.toolCall, tabId);
				this.eventBus.emit("status:tool-active", { toolName: event.toolCall.toolName, status: "executed" });
				break;
			case "result":
				if (!event.success && event.error) {
					chatView.showError(event.error, tabId);
					this.tabManager.setStatus(tabId, "error");
				}
				break;
		}
	}
}
