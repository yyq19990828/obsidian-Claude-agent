import { Plugin, WorkspaceLeaf } from "obsidian";
import { AgentService } from "./agent/agent-service";
import { ChatView, CHAT_VIEW_TYPE } from "./ui/chat-view";
import { ClaudeAgentSettingTab } from "./settings/settings-tab";
import { DEFAULT_SETTINGS } from "./constants";
import { EventBus } from "./state/event-bus";
import { ConversationStore } from "./state/conversation-store";
import { TabManager } from "./state/tab-manager";
import { InlineEditHandler } from "./ui/inline-edit/inline-edit-handler";
import type {
	AgentEvent,
	ClaudeAgentSettings,
	Conversation,
	PermissionMode,
	ThinkingBudget,
	ToolCall,
} from "./types";

export default class ClaudeAgentPlugin extends Plugin {
	settings: ClaudeAgentSettings = { ...DEFAULT_SETTINGS };
	private agentService: AgentService | null = null;
	private eventBus = new EventBus();
	private store: ConversationStore | null = null;
	private tabManager: TabManager | null = null;
	private inlineEdit: InlineEditHandler | null = null;

	/* Per-tab transient state */
	private readonly loadingTabs = new Set<string>();
	private readonly queues = new Map<string, string[]>();

	async onload(): Promise<void> {
		await this.loadSettings();

		/* State management */
		this.store = new ConversationStore(this, this.eventBus);
		this.tabManager = new TabManager(this.store, this.eventBus);

		const savedData = await this.store.load();
		if (savedData) {
			this.tabManager.restoreActiveTab(savedData.activeTabId);
		}

		/* Agent service */
		this.agentService = new AgentService(
			this.app,
			() => this.settings,
			(toolCall: ToolCall) => this.getChatView()?.requestToolApproval(toolCall) ?? Promise.resolve(false)
		);

		/* Restore session IDs */
		for (const tab of this.store.getAllTabs()) {
			if (tab.sessionId) {
				this.agentService.setSessionId(tab.id, tab.sessionId);
			}
		}

		/* Register chat view */
		this.registerView(CHAT_VIEW_TYPE, (leaf) => {
			return new ChatView(leaf, {
				eventBus: this.eventBus,
				tabManager: this.tabManager!,
				store: this.store!,
				onSend: (text, tabId) => void this.enqueueOrRun(text, tabId),
				onStop: (tabId) => this.agentService?.abortInFlight(tabId),
				onClear: (tabId) => void this.clearConversation(tabId),
				onNewTab: () => this.createNewTab(),
				onCloseTab: (tabId) => this.closeTab(tabId),
				onSwitchTab: (tabId) => this.switchTab(tabId),
				getMaxContextSize: () => this.settings.maxContextSize,
				getSettings: () => ({
					model: this.settings.model,
					thinkingBudget: this.settings.thinkingBudget,
					permissionMode: this.settings.permissionMode,
				}),
				onModelChange: (model) => { this.settings.model = model; void this.saveSettings(); },
				onThinkingChange: (budget) => { this.settings.thinkingBudget = budget as ThinkingBudget; void this.saveSettings(); },
				onPermissionChange: (mode) => { this.settings.permissionMode = mode as PermissionMode; void this.saveSettings(); },
			});
		});

		/* Ribbon icon */
		this.addRibbonIcon("bot", "Claude agent chat", () => {
			void this.activateChatView();
		});

		/* Commands */
		this.addCommand({
			id: "open-chat-panel",
			name: "Open chat panel",
			callback: () => void this.activateChatView(),
		});

		this.addCommand({
			id: "clear-conversation",
			name: "Clear conversation",
			callback: () => {
				const tabId = this.tabManager?.getActiveTabId();
				if (tabId) void this.clearConversation(tabId);
			},
		});

		this.addCommand({
			id: "new-conversation",
			name: "New conversation",
			callback: () => this.createNewTab(),
		});

		/* Inline edit */
		this.inlineEdit = new InlineEditHandler({
			onEditRequest: (selectedText, filePath, instruction) => {
				const tab = this.tabManager?.ensureActiveTab();
				if (!tab) return;
				const prompt = `Edit the following text from "${filePath}":\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nInstruction: ${instruction}`;
				void this.enqueueOrRun(prompt, tab.id);
				void this.activateChatView();
			},
		}, this.eventBus);
		this.inlineEdit.registerEditorMenu(this);

		/* Settings tab */
		this.addSettingTab(new ClaudeAgentSettingTab(this.app, this));
	}

	onunload(): void {
		this.agentService?.abortInFlight();
		this.eventBus.removeAllListeners();
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Record<string, unknown> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings(): Promise<void> {
		const allData = (await this.loadData()) ?? {};
		Object.assign(allData, this.settings);
		await this.saveData(allData);
	}

	/* ── Tab management ── */

	private createNewTab(): void {
		this.tabManager?.createAndActivate();
		this.getChatView()?.refreshTabBar();
	}

	private closeTab(tabId: string): void {
		this.agentService?.abortInFlight(tabId);
		this.agentService?.resetSession(tabId);
		this.queues.delete(tabId);
		this.loadingTabs.delete(tabId);
		this.tabManager?.closeTab(tabId);
		this.getChatView()?.refreshTabBar();
	}

	private switchTab(tabId: string): void {
		this.tabManager?.setActiveTab(tabId);
	}

	/* ── Chat view lifecycle ── */

	private async activateChatView(): Promise<void> {
		let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
			}
		}
		if (leaf) {
			void this.app.workspace.revealLeaf(leaf);
		}

		/* Ensure at least one tab exists */
		this.tabManager?.ensureActiveTab();
		this.getChatView()?.refreshTabBar();
	}

	private async clearConversation(tabId: string): Promise<void> {
		this.store?.clearMessages(tabId);
		this.queues.delete(tabId);
		this.loadingTabs.delete(tabId);
		this.agentService?.resetSession(tabId);
		this.getChatView()?.clearConversation();
		this.getChatView()?.showLoading(false);
		this.getChatView()?.showQueue(0);
	}

	/* ── Message processing ── */

	private async enqueueOrRun(userText: string, tabId: string): Promise<void> {
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

	private async processMessage(initialText: string, tabId: string): Promise<void> {
		const chatView = this.getChatView();
		if (!this.agentService || !chatView) return;

		if (this.settings.authMethod === "api_key" && !this.settings.apiKey.trim()) {
			chatView.showError("No auth configured. Add an API key in settings or switch to Claude Code subscription mode.");
			return;
		}

		const queue: string[] = [initialText];
		while (queue.length > 0) {
			const userText = queue.shift();
			if (!userText) continue;

			/* Store user message */
			this.store?.addMessage(tabId, {
				role: "user",
				content: userText,
				timestamp: Date.now(),
			});

			await chatView.addUserMessage(userText);
			chatView.startAssistantMessage(userText);
			chatView.showLoading(true);
			this.loadingTabs.add(tabId);
			this.tabManager?.setStatus(tabId, "streaming");

			let finalContent = "";
			let finalToolCalls: ToolCall[] = [];

			for await (const rawEvent of this.agentService.sendMessage(tabId, userText)) {
				const event = rawEvent as AgentEvent;
				this.handleAgentEvent(event, tabId);
				if (event.type === "assistant_complete") {
					finalContent = event.content;
					finalToolCalls = event.toolCalls ?? [];
				}
			}

			await chatView.finishAssistantMessage(finalContent, finalToolCalls);
			chatView.showLoading(false);
			this.loadingTabs.delete(tabId);
			this.tabManager?.setStatus(tabId, "idle");

			/* Store assistant message */
			this.store?.addMessage(tabId, {
				role: "assistant",
				content: finalContent,
				timestamp: Date.now(),
				toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
			});

			/* Auto-generate title from first exchange */
			const tab = this.store?.getTab(tabId);
			if (tab && tab.messages.length === 2 && tab.title === "New conversation" && this.settings.autoGenerateTitle) {
				const title = initialText.slice(0, 50) + (initialText.length > 50 ? "..." : "");
				this.store?.updateTitle(tabId, title);
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
				chatView.appendAssistantToken(event.token);
				break;
			case "thinking_token":
				this.eventBus.emit("agent:thinking-token", { tabId, token: event.token });
				break;
			case "assistant_complete":
				break;
			case "tool_summary":
				chatView.addSystemMessage(`Tool activity: ${event.summary}`);
				this.eventBus.emit("status:tool-active", { toolName: "agent", status: event.summary });
				break;
			case "tool_executed": {
				const target = event.toolCall.filePath ? ` (${event.toolCall.filePath})` : "";
				chatView.addSystemMessage(`Executed ${event.toolCall.toolName}${target}`);
				this.eventBus.emit("status:tool-active", { toolName: event.toolCall.toolName, status: "executed" });
				break;
			}
			case "result":
				if (!event.success && event.error) {
					chatView.showError(event.error);
					this.tabManager?.setStatus(tabId, "error");
				}
				break;
		}
	}

	private getChatView(): ChatView | null {
		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
		if (!leaves.length) return null;
		const leaf = leaves[0];
		if (!leaf) return null;
		const view = leaf.view;
		return view instanceof ChatView ? view : null;
	}
}
