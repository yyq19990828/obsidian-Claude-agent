import type { App, Component } from "obsidian";
import { MessageRenderer, type AssistantBubbleState, type RendererSettings } from "../message-renderer";
import { ToolApprovalUI } from "../tool-approval";
import type { ToolCall, Message } from "../../types";

export interface MessageListConfig {
	onCopyRaw: (rawMarkdown: string) => void;
	onRegenerate: (sourceUserText: string) => void;
	getSettings: () => RendererSettings;
}

/**
 * Manages per-tab message containers inside a permanent wrapper element.
 *
 * The wrapper (`wrapperEl`) occupies flex:1 in the layout and never moves.
 * Each tab gets its own scrollable child container that is hidden/shown
 * on switch. This avoids all DOM ordering issues with the input area.
 */
export class MessageList {
	private renderer: MessageRenderer;
	private toolApprovalUI: ToolApprovalUI;

	/** Permanent wrapper — always in DOM between tab bar and input area. */
	readonly wrapperEl: HTMLElement;

	/** Per-tab DOM containers (children of wrapperEl). */
	private tabContainers = new Map<string, HTMLElement>();
	/** Per-tab active streaming bubble. */
	private tabBubbles = new Map<string, AssistantBubbleState>();
	/** Currently visible tab. */
	private activeTabId: string | null = null;
	/** Tabs currently receiving streaming tokens. */
	private streamingTabs = new Set<string>();
	/** Welcome screen shown when no tabs exist. */
	private welcomeEl: HTMLElement | null = null;

	constructor(
		parentEl: HTMLElement,
		app: App,
		component: Component,
		config: MessageListConfig
	) {
		/* Permanent wrapper — flex:1, holds all tab containers */
		this.wrapperEl = parentEl.createDiv({ cls: "claude-agent-messages-wrapper" });

		/* Renderer starts with a temporary container; switchToTab will set the real one */
		const tempContainer = this.wrapperEl.createDiv({ cls: "claude-agent-messages" });
		tempContainer.hide();
		this.renderer = new MessageRenderer(app, component, tempContainer, {
			onCopyRaw: config.onCopyRaw,
			onRegenerate: config.onRegenerate,
		}, config.getSettings);
		this.toolApprovalUI = new ToolApprovalUI(tempContainer);
	}

	/* ── Tab lifecycle ── */

	/** Show a welcome screen when no tabs exist yet. */
	showWelcome(): void {
		/* Hide any active tab container */
		if (this.activeTabId) {
			const current = this.tabContainers.get(this.activeTabId);
			if (current) current.hide();
		}
		this.activeTabId = null;

		/* Show a welcome container */
		if (!this.welcomeEl) {
			this.welcomeEl = this.wrapperEl.createDiv({ cls: "claude-agent-messages" });
			this.renderer.setContainer(this.welcomeEl);
			this.renderer.addSystemMessage("Welcome. Configure authentication in settings, then send a message.");
		}
		this.welcomeEl.show();
	}

	async switchToTab(tabId: string, messages: Message[]): Promise<void> {
		/* Hide welcome screen if visible */
		if (this.welcomeEl) this.welcomeEl.hide();

		/* Hide current tab's container */
		if (this.activeTabId && this.activeTabId !== tabId) {
			const current = this.tabContainers.get(this.activeTabId);
			if (current) current.hide();
		}

		this.activeTabId = tabId;

		/* If container already exists, just show it */
		const existing = this.tabContainers.get(tabId);
		if (existing) {
			existing.show();
			this.scrollToBottom();
			return;
		}

		/* Create new container inside the wrapper */
		const container = this.wrapperEl.createDiv({ cls: "claude-agent-messages" });
		this.tabContainers.set(tabId, container);
		this.renderer.setContainer(container);

		/* Restore messages or show welcome */
		if (messages.length === 0) {
			this.renderer.addSystemMessage("Welcome. Configure authentication in settings, then send a message.");
		} else {
			for (const msg of messages) {
				if (msg.role === "user") {
					await this.renderer.addUserMessage(msg.content);
				} else if (msg.role === "assistant") {
					await this.renderer.restoreAssistantMessage(
						msg.content,
						msg.toolCalls ?? [],
						msg.thinkingBlocks ?? [],
						msg.contentBlocks,
					);
				} else if (msg.role === "system") {
					this.renderer.addSystemMessage(msg.content);
				}
			}
		}
		this.scrollToBottom();
	}

	/** Remove a tab's container and streaming state (called on tab close). */
	destroyTab(tabId: string): void {
		const container = this.tabContainers.get(tabId);
		if (container) container.remove();
		this.tabContainers.delete(tabId);
		this.tabBubbles.delete(tabId);
		this.streamingTabs.delete(tabId);
	}

	/* ── User message ── */

	async addUserMessage(content: string, tabId?: string): Promise<void> {
		const targetTab = tabId ?? this.activeTabId;
		if (!targetTab) return;
		await this.ensureContainer(targetTab);
		this.pointRendererAt(targetTab);
		await this.renderer.addUserMessage(content);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	/* ── Assistant streaming ── */

	startAssistantMessage(sourceUserText: string, tabId?: string): void {
		const targetTab = tabId ?? this.activeTabId;
		if (!targetTab) return;
		this.streamingTabs.add(targetTab);
		this.pointRendererAt(targetTab);
		const bubble = this.renderer.startAssistantMessage(sourceUserText);
		this.tabBubbles.set(targetTab, bubble);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	appendAssistantToken(token: string, tabId?: string): void {
		const targetTab = tabId ? tabId : this.findStreamingTab();
		if (!targetTab) return;
		const bubble = this.tabBubbles.get(targetTab);
		if (!bubble) return;
		this.renderer.appendAssistantToken(bubble, token);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	async finishAssistantMessage(content: string, toolCalls: ToolCall[] = [], tabId?: string): Promise<void> {
		const targetTab = tabId ? tabId : this.findStreamingTab();
		if (!targetTab) return;
		const bubble = this.tabBubbles.get(targetTab);
		if (!bubble) return;
		await this.renderer.finishAssistantMessage(bubble, content, toolCalls);
		this.tabBubbles.delete(targetTab);
		this.streamingTabs.delete(targetTab);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	/* ── Thinking stream ── */

	startThinking(tabId?: string): void {
		const targetTab = tabId ? tabId : this.findStreamingTab();
		if (!targetTab) return;
		const bubble = this.tabBubbles.get(targetTab);
		if (!bubble) return;
		this.renderer.startThinking(bubble);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	appendThinkingToken(token: string, tabId?: string): void {
		const targetTab = tabId ? tabId : this.findStreamingTab();
		if (!targetTab) return;
		const bubble = this.tabBubbles.get(targetTab);
		if (!bubble) return;
		this.renderer.appendThinkingToken(bubble, token);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	finishThinking(tabId?: string): void {
		const targetTab = tabId ? tabId : this.findStreamingTab();
		if (!targetTab) return;
		const bubble = this.tabBubbles.get(targetTab);
		if (!bubble) return;
		this.renderer.finishThinking(bubble);
	}

	/* ── Live tool call ── */

	addLiveToolCall(toolCall: ToolCall, tabId?: string): void {
		const targetTab = tabId ? tabId : this.findStreamingTab();
		if (!targetTab) return;
		const bubble = this.tabBubbles.get(targetTab);
		if (!bubble) return;
		this.renderer.addLiveToolCall(bubble, toolCall);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	/* ── System / error / approval ── */

	addSystemMessage(content: string): void {
		if (!this.activeTabId) return;
		this.pointRendererAt(this.activeTabId);
		this.renderer.addSystemMessage(content);
		this.scrollToBottom();
	}

	showError(content: string, tabId?: string): void {
		const targetTab = tabId ?? this.activeTabId;
		if (!targetTab) return;
		this.pointRendererAt(targetTab);
		this.renderer.addError(content);
		if (targetTab === this.activeTabId) this.scrollToBottom();
	}

	requestToolApproval(toolCall: ToolCall): Promise<boolean> {
		const tabId = this.activeTabId;
		if (!tabId) return Promise.resolve(false);
		const container = this.tabContainers.get(tabId);
		if (!container) return Promise.resolve(false);
		this.scrollToBottom();
		return this.toolApprovalUI.requestApproval(toolCall, container);
	}

	/* ── Clear / destroy ── */

	clear(): void {
		if (!this.activeTabId) return;
		const container = this.tabContainers.get(this.activeTabId);
		if (container) container.empty();
		this.tabBubbles.delete(this.activeTabId);
		this.streamingTabs.delete(this.activeTabId);
	}

	scrollToBottom(): void {
		if (!this.activeTabId) return;
		const container = this.tabContainers.get(this.activeTabId);
		if (container) container.scrollTop = container.scrollHeight;
	}

	destroy(): void {
		this.wrapperEl.remove();
		this.tabContainers.clear();
		this.tabBubbles.clear();
	}

	/* ── Private helpers ── */

	/** Ensure a container exists for the given tab. Creates one if needed. */
	private async ensureContainer(tabId: string): Promise<void> {
		if (this.tabContainers.has(tabId)) return;
		/* No container yet — create via switchToTab with empty messages */
		await this.switchToTab(tabId, []);
	}

	private findStreamingTab(): string | null {
		if (this.streamingTabs.size === 1) {
			return this.streamingTabs.values().next().value ?? null;
		}
		if (this.activeTabId && this.streamingTabs.has(this.activeTabId)) {
			return this.activeTabId;
		}
		return this.streamingTabs.values().next().value ?? null;
	}

	private pointRendererAt(tabId: string): void {
		const container = this.tabContainers.get(tabId);
		if (container) this.renderer.setContainer(container);
	}
}
