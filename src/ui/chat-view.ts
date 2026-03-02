import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import type { ToolCall, ConversationTab } from "../types";
import type { EventBus } from "../state/event-bus";
import type { TabManager } from "../state/tab-manager";
import type { ConversationStore } from "../state/conversation-store";
import { HeaderBar } from "./components/header-bar";
import { TabBar } from "./components/tab-bar";
import { MessageList } from "./components/message-list";
import { InputToolbar } from "./components/input-toolbar";
import { InputArea } from "./components/input-area";
import { StatusPanel } from "./components/status-panel";
import { FileContextChips } from "./components/file-context-chips";
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
	getMaxContextSize: () => number;
	getSettings: () => { model: string; thinkingBudget: string; permissionMode: string };
	onModelChange: (model: string) => void;
	onThinkingChange: (budget: string) => void;
	onPermissionChange: (mode: string) => void;
}

export class ChatView extends ItemView {
	private deps: ChatViewDeps;
	private headerBar: HeaderBar | null = null;
	private tabBar: TabBar | null = null;
	private messageList: MessageList | null = null;
	private inputToolbar: InputToolbar | null = null;
	private inputArea: InputArea | null = null;
	private statusPanel: StatusPanel | null = null;
	private fileChips: FileContextChips | null = null;
	private sidebar: ConversationSidebar | null = null;
	private loadingEl: HTMLElement | null = null;
	private queueEl: HTMLElement | null = null;
	private contextEl: HTMLElement | null = null;
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
		return "Claude agent";
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
			onClear: () => {
				const tabId = this.deps.tabManager.getActiveTabId();
				if (tabId) this.deps.onClear(tabId);
			},
			onNewTab: () => this.deps.onNewTab(),
			onToggleSidebar: () => this.toggleSidebar(),
		}, this.deps.eventBus);

		/* Tab bar */
		this.tabBar = new TabBar(this.mainContentEl, {
			onTabSelect: (tabId) => this.deps.onSwitchTab(tabId),
			onTabClose: (tabId) => this.deps.onCloseTab(tabId),
			onNewTab: () => this.deps.onNewTab(),
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
		});

		/* Loading indicator */
		this.loadingEl = this.mainContentEl.createDiv({ cls: "claude-agent-loading" });
		this.loadingEl.createSpan({ text: "Thinking..." });
		this.loadingEl.createSpan({ cls: "claude-agent-loading-dots", text: "..." });
		this.loadingEl.hide();

		/* Queue indicator */
		this.queueEl = this.mainContentEl.createDiv({ cls: "claude-agent-queue-indicator" });
		this.queueEl.hide();

		/* Status panel */
		this.statusPanel = new StatusPanel(this.mainContentEl, this.deps.eventBus);

		/* Context indicator */
		this.contextEl = this.mainContentEl.createDiv({ cls: "claude-agent-context-indicator" });

		/* File context chips */
		this.fileChips = new FileContextChips(this.mainContentEl, this.deps.eventBus);

		/* Input toolbar */
		this.inputToolbar = new InputToolbar(this.mainContentEl, {
			getSettings: this.deps.getSettings,
			onModelChange: this.deps.onModelChange,
			onThinkingChange: this.deps.onThinkingChange,
			onPermissionChange: this.deps.onPermissionChange,
		});

		/* Input area */
		this.inputArea = new InputArea(this.mainContentEl, {
			onSend: (text) => {
				const tabId = this.deps.tabManager.getActiveTabId();
				if (tabId) this.deps.onSend(text, tabId);
			},
			onStop: () => {
				const tabId = this.deps.tabManager.getActiveTabId();
				if (tabId) this.deps.onStop(tabId);
			},
		});

		/* Tab bar initial render */
		this.refreshTabBar();

		/* Sidebar initial render */
		this.sidebar.render();

		/* Listen for workspace changes */
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
			void this.updateContextIndicator();
		}));

		/* Listen for tab events */
		this.deps.eventBus.on("tab:switched", () => this.onTabSwitched());
		this.deps.eventBus.on("tab:created", () => this.refreshTabBar());
		this.deps.eventBus.on("tab:closed", () => this.refreshTabBar());

		await this.updateContextIndicator();
		this.messageList.addSystemMessage("Welcome. Configure authentication in settings, then send a message.");
	}

	/* ── Public API for main.ts ── */

	async addUserMessage(content: string): Promise<void> {
		await this.messageList?.addUserMessage(content);
	}

	startAssistantMessage(sourceUserText: string): void {
		this.messageList?.startAssistantMessage(sourceUserText);
	}

	appendAssistantToken(token: string): void {
		this.messageList?.appendAssistantToken(token);
	}

	async finishAssistantMessage(content: string, toolCalls: ToolCall[] = []): Promise<void> {
		await this.messageList?.finishAssistantMessage(content, toolCalls);
	}

	showError(content: string): void {
		this.messageList?.showError(content);
	}

	showLoading(isLoading: boolean): void {
		if (isLoading) {
			this.loadingEl?.show();
		} else {
			this.loadingEl?.hide();
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

	refreshTabBar(): void {
		const tabs = this.deps.store.getAllTabs();
		const activeId = this.deps.tabManager.getActiveTabId();
		this.tabBar?.render(tabs, activeId);
	}

	/* ── Private helpers ── */

	private async onTabSwitched(): Promise<void> {
		const tab = this.deps.tabManager.getActiveTab();
		if (!tab) return;
		this.refreshTabBar();
		await this.messageList?.restoreMessages(tab.messages);
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

	private async updateContextIndicator(): Promise<void> {
		if (!this.contextEl) return;
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile) || file.extension !== "md") {
			this.contextEl.setText("Context: no active note");
			return;
		}

		const content = await this.app.vault.read(file);
		const maxSize = this.deps.getMaxContextSize();
		const truncated = content.length > maxSize ? " (truncated)" : "";
		this.contextEl.setText(`Context: ${file.path}${truncated}`);
	}
}
