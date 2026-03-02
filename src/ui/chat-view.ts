import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { MessageRenderer, type AssistantBubbleState } from "./message-renderer";
import { ToolApprovalUI } from "./tool-approval";
import type { ToolCall, PermissionMode } from "../types";

export const CHAT_VIEW_TYPE = "claude-agent-chat-view";

interface ChatViewConfig {
	onSend: (text: string) => void;
	onClear: () => void;
	getMaxContextSize: () => number;
	getPermissionMode: () => PermissionMode;
	onModeToggle: () => void;
}

export class ChatView extends ItemView {
	private readonly config: ChatViewConfig;
	private messageRenderer: MessageRenderer | null = null;
	private toolApprovalUI: ToolApprovalUI | null = null;
	private messageContainerEl: HTMLElement | null = null;
	private inputEl: HTMLTextAreaElement | null = null;
	private sendButtonEl: HTMLButtonElement | null = null;
	private loadingEl: HTMLElement | null = null;
	private queueEl: HTMLElement | null = null;
	private contextEl: HTMLElement | null = null;
	private modeIndicatorEl: HTMLElement | null = null;
	private activeAssistantBubble: AssistantBubbleState | null = null;

	constructor(leaf: WorkspaceLeaf, config: ChatViewConfig) {
		super(leaf);
		this.config = config;
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

		const headerEl = contentEl.createDiv({ cls: "claude-agent-header" });
		headerEl.createEl("h3", { text: "Claude agent" });

		this.modeIndicatorEl = headerEl.createSpan({ cls: "claude-agent-mode-indicator" });
		this.updateModeIndicator(this.config.getPermissionMode());
		this.registerDomEvent(this.modeIndicatorEl, "click", () => this.config.onModeToggle());

		const clearButton = headerEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Clear conversation" } });
		setIcon(clearButton, "trash-2");
		this.registerDomEvent(clearButton, "click", () => this.config.onClear());

		this.messageContainerEl = contentEl.createDiv({ cls: "claude-agent-messages" });
		this.messageRenderer = new MessageRenderer(this.app, this, this.messageContainerEl, {
			onCopyRaw: (rawMarkdown) => {
				void navigator.clipboard.writeText(rawMarkdown)
					.then(() => {
						new Notice("Copied.");
					})
					.catch(() => {
						new Notice("Copy failed.");
					});
			},
			onRegenerate: (sourceUserText) => {
				this.config.onSend(sourceUserText);
			},
		});
		this.toolApprovalUI = new ToolApprovalUI(this.messageContainerEl);

		this.loadingEl = contentEl.createDiv({ cls: "claude-agent-loading" });
		this.loadingEl.createSpan({ text: "Thinking..." });
		this.loadingEl.createSpan({ cls: "claude-agent-loading-dots", text: "..." });
		this.loadingEl.hide();

		this.queueEl = contentEl.createDiv({ cls: "claude-agent-queue-indicator" });
		this.queueEl.hide();

		this.contextEl = contentEl.createDiv({ cls: "claude-agent-context-indicator" });

		const inputWrap = contentEl.createDiv({ cls: "claude-agent-input-wrap" });
		this.inputEl = inputWrap.createEl("textarea", {
			cls: "claude-agent-input",
			attr: { placeholder: "Ask about your current note...", rows: "3" },
		});
		this.sendButtonEl = inputWrap.createEl("button", { text: "Send", cls: "mod-cta claude-agent-send" });

		this.registerDomEvent(this.sendButtonEl, "click", () => this.handleSend());
		this.registerDomEvent(this.inputEl, "keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter" && !evt.shiftKey) {
				evt.preventDefault();
				this.handleSend();
			}
		});

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
			void this.updateContextIndicator();
		}));

		await this.updateContextIndicator();
		this.addSystemMessage("Welcome. Configure authentication in settings, then send a message.");
	}

	async addUserMessage(content: string): Promise<void> {
		if (this.messageRenderer) {
			await this.messageRenderer.addUserMessage(content);
		}
		this.scrollToBottom();
	}

	startAssistantMessage(sourceUserText: string): void {
		if (!this.messageRenderer) {
			return;
		}
		this.activeAssistantBubble = this.messageRenderer.startAssistantMessage(sourceUserText);
		this.scrollToBottom();
	}

	appendAssistantToken(token: string): void {
		if (this.activeAssistantBubble && this.messageRenderer) {
			this.messageRenderer.appendAssistantToken(this.activeAssistantBubble, token);
			this.scrollToBottom();
		}
	}

	async finishAssistantMessage(content: string, toolCalls: ToolCall[] = []): Promise<void> {
		if (!this.activeAssistantBubble || !this.messageRenderer) {
			return;
		}

		await this.messageRenderer.finishAssistantMessage(this.activeAssistantBubble, content, toolCalls);
		this.activeAssistantBubble = null;
		this.scrollToBottom();
	}

	showError(content: string): void {
		this.messageRenderer?.addError(content);
		this.scrollToBottom();
	}

	updateModeIndicator(mode: PermissionMode): void {
		if (!this.modeIndicatorEl) return;
		this.modeIndicatorEl.setText(mode === "safe" ? "Safe mode" : "Super mode");
		this.modeIndicatorEl.removeClass("claude-agent-mode-safe", "claude-agent-mode-super");
		this.modeIndicatorEl.addClass(mode === "safe" ? "claude-agent-mode-safe" : "claude-agent-mode-super");
	}

	showLoading(isLoading: boolean): void {
		if (!this.loadingEl || !this.sendButtonEl) {
			return;
		}
		if (isLoading) {
			this.loadingEl.show();
			this.sendButtonEl.disabled = true;
		} else {
			this.loadingEl.hide();
			this.sendButtonEl.disabled = false;
		}
	}

	showQueue(count: number): void {
		if (!this.queueEl) {
			return;
		}
		if (count <= 0) {
			this.queueEl.hide();
			return;
		}
		this.queueEl.setText(`${count} message(s) queued`);
		this.queueEl.show();
	}

	addSystemMessage(content: string): void {
		this.messageRenderer?.addSystemMessage(content);
		this.scrollToBottom();
	}

	clearConversation(): void {
		this.messageContainerEl?.empty();
		this.activeAssistantBubble = null;
		this.addSystemMessage("Conversation cleared. Start a new thread.");
	}

	requestToolApproval(toolCall: ToolCall): Promise<boolean> {
		if (!this.toolApprovalUI) {
			return Promise.resolve(false);
		}
		this.scrollToBottom();
		return this.toolApprovalUI.requestApproval(toolCall);
	}

	private handleSend(): void {
		if (!this.inputEl) {
			return;
		}
		const text = this.inputEl.value.trim();
		if (!text) {
			return;
		}

		this.inputEl.value = "";
		this.config.onSend(text);
	}

	private async updateContextIndicator(): Promise<void> {
		if (!this.contextEl) {
			return;
		}

		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile) || file.extension !== "md") {
			this.contextEl.setText("Context: no active note");
			return;
		}

		const content = await this.app.vault.read(file);
		const maxSize = this.config.getMaxContextSize();
		const truncated = content.length > maxSize ? " (truncated)" : "";
		this.contextEl.setText(`Context: ${file.path}${truncated}`);
	}

	private scrollToBottom(): void {
		if (!this.messageContainerEl) {
			return;
		}
		this.messageContainerEl.scrollTop = this.messageContainerEl.scrollHeight;
	}
}
