import { Plugin, WorkspaceLeaf, FileSystemAdapter, Notice } from "obsidian";
import process from "process";
import { AgentService } from "./agent/agent-service";
import { ChatView, CHAT_VIEW_TYPE } from "./ui/chat-view";
import { ClaudeAgentSettingTab } from "./settings/settings-tab";
import { DEFAULT_SETTINGS } from "./constants";
import { EventBus } from "./state/event-bus";
import { ConversationStore } from "./state/conversation-store";
import { TabManager } from "./state/tab-manager";
import { InlineEditHandler } from "./ui/inline-edit/inline-edit-handler";
import { SettingsResolver } from "./settings/settings-resolver";
import { MessageProcessor } from "./services/message-processor";
import { migrateSettings, mergeWithDefaults } from "./settings/settings-migrator";
import type {
	ClaudeAgentSettings,
	PermissionMode,
	ResolvedSettings,
	ThinkingBudget,
	ToolCall,
} from "./types";

export default class ClaudeAgentPlugin extends Plugin {
	settings: ClaudeAgentSettings = { ...DEFAULT_SETTINGS };
	resolvedSettings: ResolvedSettings = { merged: { ...DEFAULT_SETTINGS }, overrides: {} };
	resolver: SettingsResolver | null = null;
	private agentService: AgentService | null = null;
	private eventBus = new EventBus();
	private store: ConversationStore | null = null;
	private tabManager: TabManager | null = null;
	private inlineEdit: InlineEditHandler | null = null;
	private messageProcessor: MessageProcessor | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		/* Construct resolver */
		const adapter = this.app.vault.adapter;
		const vaultDir = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
		const pluginDir = vaultDir ? `${vaultDir}/.obsidian/plugins/${this.manifest.id}` : "";
		const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
		this.resolver = new SettingsResolver(pluginDir, vaultDir, homeDir);
		this.resolvedSettings = this.resolver.resolve(this.settings);

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
			() => this.resolvedSettings.merged,
			(toolCall: ToolCall) => this.getChatView()?.requestToolApproval(toolCall) ?? Promise.resolve(false),
			pluginDir,
		);

		/* Restore session IDs */
		for (const tab of this.store.getAllTabs()) {
			if (tab.sessionId) {
				this.agentService.setSessionId(tab.id, tab.sessionId);
			}
		}

		/* Message processor */
		this.messageProcessor = new MessageProcessor(
			this.agentService,
			this.store,
			this.tabManager,
			this.eventBus,
			() => this.getChatView(),
			() => this.settings,
			() => this.activateChatView(),
		);

		/* Register chat view */
		this.registerView(CHAT_VIEW_TYPE, (leaf) => {
			return new ChatView(leaf, {
				eventBus: this.eventBus,
				tabManager: this.tabManager!,
				store: this.store!,
				onSend: (text, tabId) => void this.messageProcessor?.enqueueOrRun(text, tabId),
				onStop: (tabId) => this.agentService?.abortInFlight(tabId),
				onClear: (tabId) => void this.clearConversation(tabId),
				onNewTab: () => this.createNewTab(),
				onCloseTab: (tabId) => this.closeTab(tabId),
				onSwitchTab: (tabId) => this.switchTab(tabId),
				onOpenSettings: () => this.openPluginSettings(),
				getMaxContextSize: () => this.settings.maxContextSize,
				getSettings: () => ({
					model: this.settings.model,
					thinkingBudget: this.settings.thinkingBudget,
					permissionMode: this.settings.permissionMode,
					showDetailedThinking: this.settings.showDetailedThinking,
					showDetailedTools: this.settings.showDetailedTools,
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
				void this.messageProcessor?.enqueueOrRun(prompt, tab.id);
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
		const saved = ((await this.loadData()) ?? {}) as Partial<ClaudeAgentSettings>;
		const migrated = migrateSettings(saved);
		this.settings = mergeWithDefaults(saved, migrated);

		if (this.resolver) {
			this.resolvedSettings = this.resolver.resolve(this.settings);
		}
	}

	async saveSettings(): Promise<void> {
		if (this.resolver) {
			this.resolvedSettings = this.resolver.resolve(this.settings);
		}
		this.agentService?.resetAllSessions();

		const allData = (await this.loadData()) ?? {};
		Object.assign(allData, this.settings);
		await this.saveData(allData);
	}

	reloadConfigFiles(): void {
		if (this.resolver) {
			this.resolvedSettings = this.resolver.resolve(this.settings);
		}
		this.agentService?.invalidateCache();
	}

	async saveAndApply(): Promise<void> {
		await this.saveSettings();

		const activeTabId = this.tabManager?.getActiveTabId();
		if (!activeTabId) return;

		const activeTab = this.store?.getTab(activeTabId);
		if (activeTab && activeTab.messages.length > 0) {
			this.createNewTab();
			new Notice("Settings applied. A new conversation has been started.");
		} else {
			new Notice("Settings applied.");
		}
	}

	/* ── Tab management ── */

	private createNewTab(): void {
		/* Don't create a tab yet — just show the welcome screen.
		   A real tab will be created when the user sends their first message. */
		this.tabManager?.deactivate();
		this.getChatView()?.showWelcome();
		this.getChatView()?.refreshSidebar();
	}

	private closeTab(tabId: string): void {
		this.agentService?.abortInFlight(tabId);
		this.agentService?.resetSession(tabId);
		this.messageProcessor?.clearTabState(tabId);
		this.tabManager?.closeTab(tabId);
		this.getChatView()?.refreshSidebar();
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

		/* If there are existing tabs, make sure one is active.
		   Otherwise leave empty — a tab will be created on first send. */
		const tabs = this.store?.getAllTabs() ?? [];
		if (tabs.length > 0 && !this.tabManager?.getActiveTab()) {
			this.tabManager?.ensureActiveTab();
		}
		this.getChatView()?.refreshSidebar();
	}

	private async clearConversation(tabId: string): Promise<void> {
		this.store?.clearMessages(tabId);
		this.messageProcessor?.clearTabState(tabId);
		this.agentService?.resetSession(tabId);
		this.getChatView()?.clearConversation();
		this.getChatView()?.showLoading(false, tabId);
		this.getChatView()?.showQueue(0);
	}

	private openPluginSettings(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const setting = (this.app as any).setting;
		if (setting) {
			setting.open();
			setting.openTabById(this.manifest.id);
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
