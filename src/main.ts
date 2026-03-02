import { Plugin, WorkspaceLeaf } from "obsidian";
import { AgentService } from "./agent/agent-service";
import { ChatView, CHAT_VIEW_TYPE } from "./ui/chat-view";
import { requestSuperModeConfirmation } from "./ui/confirmation-modal";
import { ClaudeAgentSettingTab, DEFAULT_SETTINGS, DEFAULT_SDK_TOOL_TOGGLES, DEFAULT_CLAUDE_SETTING_SOURCES } from "./settings";
import type { AgentEvent, ClaudeAgentSettings, Conversation, PermissionMode, ToolCall } from "./types";

export default class ClaudeAgentPlugin extends Plugin {
	settings: ClaudeAgentSettings = DEFAULT_SETTINGS;
	private agentService: AgentService | null = null;
	private readonly conversation: Conversation = {
		messages: [],
		sessionId: undefined,
		isLoading: false,
		queue: [],
	};

	async onload(): Promise<void> {
		await this.loadSettings();

		this.agentService = new AgentService(
			this.app,
			() => this.settings,
			(toolCall: ToolCall) => this.getChatView()?.requestToolApproval(toolCall) ?? Promise.resolve(false)
		);

		this.registerView(CHAT_VIEW_TYPE, (leaf) => {
			return new ChatView(leaf, {
				onSend: (text) => {
					void this.enqueueOrRun(text);
				},
				onClear: () => {
					void this.clearConversation();
				},
				getMaxContextSize: () => this.settings.maxContextSize,
				getPermissionMode: () => this.settings.permissionMode,
				onModeToggle: () => {
					void this.handleModeToggle();
				},
			});
		});

		this.addRibbonIcon("bot", "Claude agent chat", () => {
			void this.activateChatView();
		});

		this.addCommand({
			id: "open-chat-panel",
			name: "Open chat panel",
			callback: () => {
				void this.activateChatView();
			},
		});

		this.addCommand({
			id: "clear-conversation",
			name: "Clear conversation",
			callback: () => {
				void this.clearConversation();
			},
		});

		const settingTab = new ClaudeAgentSettingTab(this.app, this);
		settingTab.onModeChange = () => {
			this.agentService?.resetSession();
			this.getChatView()?.updateModeIndicator(this.settings.permissionMode);
		};
		this.addSettingTab(settingTab);
	}

	onunload(): void {
		this.agentService?.abortInFlight();
	}

	async loadSettings(): Promise<void> {
		const saved = ((await this.loadData()) ?? {}) as Partial<ClaudeAgentSettings>;
		this.settings = {
			...DEFAULT_SETTINGS,
			...saved,
			sdkToolToggles: { ...DEFAULT_SDK_TOOL_TOGGLES, ...saved.sdkToolToggles },
			claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES, ...saved.claudeSettingSources },
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async handleModeToggle(): Promise<void> {
		if (this.settings.permissionMode === "super") {
			this.settings.permissionMode = "safe";
		} else {
			const confirmed = await requestSuperModeConfirmation(this.app);
			if (!confirmed) return;
			this.settings.permissionMode = "super";
		}
		await this.saveSettings();
		this.agentService?.resetSession();
		this.getChatView()?.updateModeIndicator(this.settings.permissionMode);
	}

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
	}

	private async clearConversation(): Promise<void> {
		const chatView = this.getChatView();
		this.conversation.messages = [];
		this.conversation.queue = [];
		this.conversation.isLoading = false;
		chatView?.showQueue(0);
		chatView?.showLoading(false);
		chatView?.clearConversation();
		this.agentService?.resetSession();
	}

	private async enqueueOrRun(userText: string): Promise<void> {
		if (!userText.trim()) {
			return;
		}

		await this.activateChatView();

		if (this.conversation.isLoading) {
			this.conversation.queue.push(userText);
			this.getChatView()?.showQueue(this.conversation.queue.length);
			return;
		}

		await this.processMessage(userText);
	}

	private async processMessage(initialText: string): Promise<void> {
		const chatView = this.getChatView();
		if (!this.agentService || !chatView) {
			return;
		}

		if (this.settings.authMethod === "api_key" && !this.settings.apiKey.trim()) {
			chatView.showError("No auth configured. Add an API key in settings or switch to Claude Code subscription mode.");
			return;
		}

		const queue: string[] = [initialText];
		while (queue.length > 0) {
			const userText = queue.shift();
			if (!userText) {
				continue;
			}

			await chatView.addUserMessage(userText);
			chatView.startAssistantMessage(userText);
			chatView.showLoading(true);
			this.conversation.isLoading = true;

			let finalContent = "";
			let finalToolCalls: ToolCall[] = [];

			for await (const rawEvent of this.agentService.sendMessage(userText)) {
				const event = rawEvent as AgentEvent;
				this.handleAgentEvent(event);
				if (event.type === "assistant_complete") {
					finalContent = event.content;
					finalToolCalls = event.toolCalls ?? [];
				}
			}

			await chatView.finishAssistantMessage(finalContent, finalToolCalls);
			chatView.showLoading(false);
			this.conversation.isLoading = false;

			if (this.conversation.queue.length > 0) {
				queue.push(...this.conversation.queue.splice(0));
				chatView.showQueue(this.conversation.queue.length);
			}
		}
	}

	private handleAgentEvent(event: AgentEvent): void {
		const chatView = this.getChatView();
		if (!chatView) {
			return;
		}

		switch (event.type) {
			case "stream_token":
				chatView.appendAssistantToken(event.token);
				break;
			case "assistant_complete":
				break;
			case "tool_summary":
				chatView.addSystemMessage(`Tool activity: ${event.summary}`);
				break;
			case "tool_executed": {
				const target = event.toolCall.filePath ? ` (${event.toolCall.filePath})` : "";
				chatView.addSystemMessage(`Executed ${event.toolCall.toolName}${target}`);
				break;
			}
			case "result":
				if (!event.success && event.error) {
					chatView.showError(event.error);
				}
				break;
		}
	}

	private getChatView(): ChatView | null {
		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
		if (!leaves.length) {
			return null;
		}

		const leaf = leaves[0];
		if (!leaf) {
			return null;
		}

		const view = leaf.view;
		return view instanceof ChatView ? view : null;
	}
}
