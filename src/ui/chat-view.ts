import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type { ToolCall } from "../types";
import type { EventBus } from "../state/event-bus";
import type { TabManager } from "../state/tab-manager";
import type { ConversationStore } from "../state/conversation-store";
import { HeaderBar } from "./components/header-bar";
import { MessageList } from "./components/message-list";
import { InputToolbar } from "./components/input-toolbar";
import { InputArea } from "./components/input-area";
import { ActiveTabChips } from "./components/active-tab-chips";
import { ConversationSidebar } from "./sidebar/conversation-sidebar";

export const CHAT_VIEW_TYPE = "claude-agent-chat-view";

export interface ChatViewDeps {
	eventBus: EventBus;
	tabManager: TabManager;
	store: ConversationStore;
	onSend: (text: string, tabId: string) => void;
	onStop: (tabId: string) => void;
	onClear: (tabId: string) => void;
	onNewTab: () => void;
	onCloseTab: (tabId: string) => void;
	onSwitchTab: (tabId: string) => void;
	onOpenSettings: () => void;
	getMaxContextSize: () => number;
	getSettings: () => { model: string; thinkingBudget: string; permissionMode: string; showDetailedThinking: boolean; showDetailedTools: boolean };
	onModelChange: (model: string) => void;
	onThinkingChange: (budget: string) => void;
	onPermissionChange: (mode: string) => void;
}

export class ChatView extends ItemView {
	private deps: ChatViewDeps;
	private headerBar: HeaderBar | null = null;
	private messageList: MessageList | null = null;
	private inputToolbar: InputToolbar | null = null;
	private inputArea: InputArea | null = null;
	private activeTabChips: ActiveTabChips | null = null;
	private sidebar: ConversationSidebar | null = null;
	private queueEl: HTMLElement | null = null;
	private mainContentEl: HTMLElement | null = null;
	private sidebarVisible = false;

	constructor(leaf: WorkspaceLeaf, deps: ChatViewDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return CHAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Claude Agent";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("claude-agent-view");

		const layoutEl = contentEl.createDiv({ cls: "claude-agent-layout" });

		/* ── Sidebar ── */
		this.sidebar = new ConversationSidebar(layoutEl, {
			onSelectConversation: (tabId) => this.deps.onSwitchTab(tabId),
			onDeleteConversation: (tabId) => this.deps.onCloseTab(tabId),
			onNewConversation: () => this.deps.onNewTab(),
		}, this.deps.eventBus, this.deps.store);

		/* ── Main content column ── */
		this.mainContentEl = layoutEl.createDiv({ cls: "claude-agent-main" });

		/* Header */
		this.headerBar = new HeaderBar(this.mainContentEl, {
			onNewTab: () => this.deps.onNewTab(),
			onToggleSidebar: () => this.toggleSidebar(),
			onOpenSettings: () => this.deps.onOpenSettings(),
		}, this.deps.eventBus);

		/* Message list */
		this.messageList = new MessageList(this.mainContentEl, this.app, this, {
			onCopyRaw: (raw) => {
				void navigator.clipboard.writeText(raw)
					.then(() => new Notice("Copied."))
					.catch(() => new Notice("Copy failed."));
			},
			onRegenerate: (userText) => {
				const tabId = this.deps.tabManager.getActiveTabId();
				if (tabId) this.deps.onSend(userText, tabId);
			},
			getSettings: () => {
				const s = this.deps.getSettings();
				return { showDetailedThinking: s.showDetailedThinking, showDetailedTools: s.showDetailedTools };
			},
		});

		/* Queue indicator */
		this.queueEl = this.mainContentEl.createDiv({ cls: "claude-agent-queue-indicator" });
		this.queueEl.hide();

		/* ── Input container (chips + textarea + hint + bottom bar) ── */
		this.inputArea = new InputArea(this.mainContentEl, {
			onSend: (text) => {
				/* No active tab → always create a new one (fresh start or after "new conversation") */
				let tabId = this.deps.tabManager.getActiveTabId();
				if (!tabId) {
					const tab = this.deps.tabManager.createAndActivate();
					tabId = tab.id;
				}
				this.deps.onSend(text, tabId);
			},
			onStop: () => {
				const tabId = this.deps.tabManager.getActiveTabId();
				if (tabId) this.deps.onStop(tabId);
			},
		});

		/* Active tab chips — show open workspace tabs as toggleable context */
		this.activeTabChips = new ActiveTabChips(this.inputArea.containerEl, this.app, this.deps.eventBus);
		/* Move active tab chips to be the first child of container */
		const activeTabChipsEl = this.inputArea.containerEl.lastElementChild;
		if (activeTabChipsEl) {
			this.inputArea.containerEl.insertBefore(activeTabChipsEl, this.inputArea.containerEl.firstChild);
		}

		/* Input toolbar — inject into bottom bar (before spacer) */
		this.inputToolbar = new InputToolbar(this.inputArea.bottomBarEl, {
			getSettings: this.deps.getSettings,
			onModelChange: this.deps.onModelChange,
			onThinkingChange: this.deps.onThinkingChange,
			onPermissionChange: this.deps.onPermissionChange,
		});
		/* Move toolbar groups before the spacer */
		const spacer = this.inputArea.bottomBarEl.querySelector(".claude-agent-bottom-bar-spacer");
		if (spacer) {
			const groups = this.inputArea.bottomBarEl.querySelectorAll(".claude-agent-toolbar-group");
			groups.forEach((g) => spacer.before(g));
		}

		/* Sidebar initial render */
		this.sidebar.render();

		/* Listen for tab events */
		this.deps.eventBus.on("tab:switched", () => this.onTabSwitched());
		this.deps.eventBus.on("tab:created", () => this.sidebar?.render());
		this.deps.eventBus.on("tab:closed", (tabId) => {
			this.messageList?.destroyTab(tabId);
			this.sidebar?.render();
		});

		/* Refresh active tab chips when workspace layout changes */
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.activeTabChips?.refresh();
			})
		);

		/* Show active tab content, or welcome screen if no tabs yet */
		const activeTab = this.deps.tabManager.getActiveTab();
		if (activeTab) {
			void this.messageList?.switchToTab(activeTab.id, activeTab.messages);
		} else {
			this.messageList?.showWelcome();
		}
	}

	/* ── Public API for main.ts ── */

	async addUserMessage(content: string, tabId?: string): Promise<void> {
		await this.messageList?.addUserMessage(content, tabId);
	}

	startAssistantMessage(sourceUserText: string, tabId?: string): void {
		this.messageList?.startAssistantMessage(sourceUserText, tabId);
	}

	appendAssistantToken(token: string, tabId?: string): void {
		this.messageList?.appendAssistantToken(token, tabId);
	}

	async finishAssistantMessage(content: string, toolCalls: ToolCall[] = [], tabId?: string): Promise<void> {
		await this.messageList?.finishAssistantMessage(content, toolCalls, tabId);
	}

	/* ── Thinking stream ── */

	startThinking(tabId?: string): void {
		this.messageList?.startThinking(tabId);
	}

	appendThinkingToken(token: string, tabId?: string): void {
		this.messageList?.appendThinkingToken(token, tabId);
	}

	finishThinking(tabId?: string): void {
		this.messageList?.finishThinking(tabId);
	}

	/* ── Live tool call ── */

	addLiveToolCall(toolCall: ToolCall, tabId?: string): void {
		this.messageList?.addLiveToolCall(toolCall, tabId);
	}

	showError(content: string, tabId?: string): void {
		this.messageList?.showError(content, tabId);
	}

	showLoading(isLoading: boolean, tabId?: string): void {
		/* Only update input state if the affected tab is the currently active tab */
		if (tabId) {
			const activeId = this.deps.tabManager.getActiveTabId();
			if (activeId !== tabId) return;
		}
		this.inputArea?.setStreaming(isLoading);
	}

	showQueue(count: number): void {
		if (!this.queueEl) return;
		if (count <= 0) {
			this.queueEl.hide();
			return;
		}
		this.queueEl.setText(`${count} message(s) queued`);
		this.queueEl.show();
	}

	addSystemMessage(content: string): void {
		this.messageList?.addSystemMessage(content);
	}

	clearConversation(): void {
		this.messageList?.clear();
		this.messageList?.addSystemMessage("Conversation cleared. Start a new thread.");
	}

	requestToolApproval(toolCall: ToolCall): Promise<boolean> {
		return this.messageList?.requestToolApproval(toolCall) ?? Promise.resolve(false);
	}

	/** Show welcome screen (used by "new conversation" before first send). */
	showWelcome(): void {
		this.messageList?.showWelcome();
		this.inputArea?.setStreaming(false);
	}

	refreshSidebar(): void {
		this.sidebar?.render();
	}

	/* ── Private helpers ── */

	private async onTabSwitched(): Promise<void> {
		const tab = this.deps.tabManager.getActiveTab();
		if (!tab) return;
		await this.messageList?.switchToTab(tab.id, tab.messages);
		/* Sync input state to the new tab's streaming status */
		this.inputArea?.setStreaming(tab.status === "streaming");
		this.sidebar?.render();
	}

	private toggleSidebar(): void {
		this.sidebarVisible = !this.sidebarVisible;
		this.deps.eventBus.emit("sidebar:toggle", this.sidebarVisible);
		const layout = this.contentEl.querySelector(".claude-agent-layout");
		if (layout) {
			layout.classList.toggle("sidebar-open", this.sidebarVisible);
		}
	}
}
