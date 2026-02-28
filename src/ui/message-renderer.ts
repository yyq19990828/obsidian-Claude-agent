import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import type { ToolCall } from "../types";

interface AssistantBubbleState {
	rowEl: HTMLElement;
	wrapperEl: HTMLElement;
	contentEl: HTMLElement;
	buffer: string;
	renderTimer: number | null;
	sourceUserText: string;
}

interface MessageActionHandlers {
	onCopyRaw: (rawMarkdown: string) => void;
	onRegenerate: (sourceUserText: string) => void;
}

export class MessageRenderer {
	private readonly app: App;
	private readonly component: Component;
	private readonly containerEl: HTMLElement;
	private readonly actions: MessageActionHandlers;

	constructor(app: App, component: Component, containerEl: HTMLElement, actions: MessageActionHandlers) {
		this.app = app;
		this.component = component;
		this.containerEl = containerEl;
		this.actions = actions;
	}

	async addUserMessage(content: string): Promise<void> {
		const rowEl = this.containerEl.createDiv({ cls: "claude-agent-message-row claude-agent-message-row-user" });
		const bubble = rowEl.createDiv({ cls: "claude-agent-message claude-agent-message-user" });
		const contentEl = bubble.createDiv({ cls: "claude-agent-markdown" });
		await this.renderMarkdown(contentEl, content);
		this.renderUserActions(rowEl, content);
	}

	startAssistantMessage(sourceUserText: string): AssistantBubbleState {
		const rowEl = this.containerEl.createDiv({ cls: "claude-agent-message-row claude-agent-message-row-assistant" });
		const wrapperEl = rowEl.createDiv({ cls: "claude-agent-message claude-agent-message-assistant" });
		const contentEl = wrapperEl.createDiv({ cls: "claude-agent-markdown" });
		return {
			rowEl,
			wrapperEl,
			contentEl,
			buffer: "",
			renderTimer: null,
			sourceUserText,
		};
	}

	appendAssistantToken(state: AssistantBubbleState, token: string): void {
		state.buffer += token;
		if (state.renderTimer !== null) {
			window.clearTimeout(state.renderTimer);
		}
		state.renderTimer = window.setTimeout(() => {
			void this.renderMarkdown(state.contentEl, state.buffer);
			state.renderTimer = null;
		}, 70);
	}

	async finishAssistantMessage(
		state: AssistantBubbleState,
		content: string,
		toolCalls: ToolCall[] = []
	): Promise<void> {
		if (state.renderTimer !== null) {
			window.clearTimeout(state.renderTimer);
			state.renderTimer = null;
		}

		state.buffer = content || state.buffer;
		await this.renderMarkdown(state.contentEl, state.buffer);

		for (const toolCall of toolCalls) {
			this.renderToolCallCard(state.wrapperEl, toolCall);
		}

		this.renderAssistantActions(state.rowEl, state.buffer, state.sourceUserText);
	}

	addSystemMessage(content: string): void {
		const el = this.containerEl.createDiv({ cls: "claude-agent-message claude-agent-message-system" });
		el.setText(content);
	}

	addError(content: string): void {
		const el = this.containerEl.createDiv({ cls: "claude-agent-message claude-agent-message-error" });
		setIcon(el.createSpan({ cls: "claude-agent-error-icon" }), "alert-triangle");
		el.createSpan({ text: content });
	}

	private async renderMarkdown(targetEl: HTMLElement, markdown: string): Promise<void> {
		targetEl.empty();
		await MarkdownRenderer.render(this.app, markdown, targetEl, "", this.component);
		this.decorateCodeBlocks(targetEl);
	}

	private decorateCodeBlocks(targetEl: HTMLElement): void {
		const codeBlocks = targetEl.querySelectorAll("pre > code");
		codeBlocks.forEach((codeEl) => {
			const preEl = codeEl.parentElement;
			if (!preEl) {
				return;
			}

			const className = codeEl.className || "";
			const match = className.match(/(?:^|\s)language-([a-z0-9_+-]+)/i);
			const lang = (match?.[1] ?? "code").toUpperCase();
			preEl.setAttribute("data-lang", `<${lang}>`);

			const copyButton = preEl.createEl("button", {
				cls: "claude-agent-code-copy-button",
				attr: {
					type: "button",
					"aria-label": "Copy code block",
					"data-tooltip": "Copy code",
				},
			});
			setIcon(copyButton, "copy");
			copyButton.addEventListener("click", () => {
				const codeText = codeEl.textContent ?? "";
				this.actions.onCopyRaw(codeText);
			});
		});
	}

	private renderToolCallCard(parentEl: HTMLElement, toolCall: ToolCall): void {
		const card = parentEl.createDiv({ cls: `claude-agent-tool-card is-${toolCall.status}` });
		const row = card.createDiv({ cls: "claude-agent-tool-card-header" });
		row.createSpan({ text: toolCall.toolName });
		row.createSpan({ cls: "claude-agent-tool-status", text: toolCall.status.toUpperCase() });

		if (toolCall.filePath) {
			card.createDiv({ cls: "claude-agent-tool-path", text: toolCall.filePath });
		}

		if (toolCall.result) {
			card.createDiv({ cls: "claude-agent-tool-result", text: toolCall.result });
		}
	}

	private renderAssistantActions(
		rowEl: HTMLElement,
		rawMarkdown: string,
		sourceUserText: string
	): void {
		const actionBar = rowEl.createDiv({ cls: "claude-agent-message-actions claude-agent-assistant-actions" });
		const copyButton = actionBar.createEl("button", {
			cls: "claude-agent-message-action-button",
			attr: {
				type: "button",
				"aria-label": "Copy raw message",
				"data-tooltip": "Copy raw message",
			},
		});
		setIcon(copyButton, "copy");
		copyButton.addEventListener("click", () => this.actions.onCopyRaw(rawMarkdown));

		const regenerateButton = actionBar.createEl("button", {
			cls: "claude-agent-message-action-button",
			attr: {
				type: "button",
				"aria-label": "Regenerate response",
				"data-tooltip": "Regenerate",
			},
		});
		setIcon(regenerateButton, "refresh-cw");
		regenerateButton.addEventListener("click", () => this.actions.onRegenerate(sourceUserText));
	}

	private renderUserActions(rowEl: HTMLElement, rawText: string): void {
		const actionBar = rowEl.createDiv({ cls: "claude-agent-message-actions claude-agent-user-actions" });
		const copyButton = actionBar.createEl("button", {
			cls: "claude-agent-message-action-button",
			attr: {
				type: "button",
				"aria-label": "Copy message",
				"data-tooltip": "Copy message",
			},
		});
		setIcon(copyButton, "copy");
		copyButton.addEventListener("click", () => this.actions.onCopyRaw(rawText));
	}
}

export type { AssistantBubbleState };
