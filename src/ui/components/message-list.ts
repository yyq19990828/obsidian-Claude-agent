import type { App, Component } from "obsidian";
import { MessageRenderer, type AssistantBubbleState, type RendererSettings } from "../message-renderer";
import { ToolApprovalUI } from "../tool-approval";
import type { ToolCall, Message } from "../../types";

export interface MessageListConfig {
	onCopyRaw: (rawMarkdown: string) => void;
	onRegenerate: (sourceUserText: string) => void;
	getSettings: () => RendererSettings;
}

export class MessageList {
	private containerEl: HTMLElement;
	private renderer: MessageRenderer;
	private toolApprovalUI: ToolApprovalUI;
	private activeAssistantBubble: AssistantBubbleState | null = null;

	constructor(
		parentEl: HTMLElement,
		app: App,
		component: Component,
		config: MessageListConfig
	) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-messages" });
		this.renderer = new MessageRenderer(app, component, this.containerEl, {
			onCopyRaw: config.onCopyRaw,
			onRegenerate: config.onRegenerate,
		}, config.getSettings);
		this.toolApprovalUI = new ToolApprovalUI(this.containerEl);
	}

	async addUserMessage(content: string): Promise<void> {
		await this.renderer.addUserMessage(content);
		this.scrollToBottom();
	}

	startAssistantMessage(sourceUserText: string): void {
		this.activeAssistantBubble = this.renderer.startAssistantMessage(sourceUserText);
		this.scrollToBottom();
	}

	appendAssistantToken(token: string): void {
		if (this.activeAssistantBubble) {
			this.renderer.appendAssistantToken(this.activeAssistantBubble, token);
			this.scrollToBottom();
		}
	}

	/* ── Thinking stream proxy ── */

	startThinking(): void {
		if (this.activeAssistantBubble) {
			this.renderer.startThinking(this.activeAssistantBubble);
			this.scrollToBottom();
		}
	}

	appendThinkingToken(token: string): void {
		if (this.activeAssistantBubble) {
			this.renderer.appendThinkingToken(this.activeAssistantBubble, token);
			this.scrollToBottom();
		}
	}

	finishThinking(): void {
		if (this.activeAssistantBubble) {
			this.renderer.finishThinking(this.activeAssistantBubble);
		}
	}

	/* ── Live tool call proxy ── */

	addLiveToolCall(toolCall: ToolCall): void {
		if (this.activeAssistantBubble) {
			this.renderer.addLiveToolCall(this.activeAssistantBubble, toolCall);
			this.scrollToBottom();
		}
	}

	async finishAssistantMessage(content: string, toolCalls: ToolCall[] = []): Promise<void> {
		if (!this.activeAssistantBubble) return;
		await this.renderer.finishAssistantMessage(this.activeAssistantBubble, content, toolCalls);
		this.activeAssistantBubble = null;
		this.scrollToBottom();
	}

	addSystemMessage(content: string): void {
		this.renderer.addSystemMessage(content);
		this.scrollToBottom();
	}

	showError(content: string): void {
		this.renderer.addError(content);
		this.scrollToBottom();
	}

	requestToolApproval(toolCall: ToolCall): Promise<boolean> {
		this.scrollToBottom();
		return this.toolApprovalUI.requestApproval(toolCall);
	}

	clear(): void {
		this.containerEl.empty();
		this.activeAssistantBubble = null;
	}

	async restoreMessages(messages: Message[]): Promise<void> {
		this.clear();
		for (const msg of messages) {
			if (msg.role === "user") {
				await this.renderer.addUserMessage(msg.content);
			} else if (msg.role === "assistant") {
				const bubble = this.renderer.startAssistantMessage("");
				await this.renderer.finishAssistantMessage(bubble, msg.content, msg.toolCalls ?? []);
			} else if (msg.role === "system") {
				this.renderer.addSystemMessage(msg.content);
			}
		}
		this.scrollToBottom();
	}

	scrollToBottom(): void {
		this.containerEl.scrollTop = this.containerEl.scrollHeight;
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
