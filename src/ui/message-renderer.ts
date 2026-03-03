import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import { ThinkingBlockRenderer } from "./components/thinking-block";
import { renderToolCallCard } from "./components/tool-call-card";
import { renderAssistantActions, renderUserActions } from "./components/message-actions";
import type { MessageActionHandlers } from "./components/message-actions";
import type { ContentBlock, ToolCall, ThinkingBlock } from "../types";

interface RendererSettings {
	showDetailedThinking: boolean;
	showDetailedTools: boolean;
}

/**
 * Tracks the state of a streaming assistant message bubble.
 *
 * The "flow" model: instead of fixed toolContainerEl + contentEl,
 * content segments and tool cards are appended to `flowEl` in
 * chronological (streaming) order.
 */
interface AssistantBubbleState {
	rowEl: HTMLElement;
	wrapperEl: HTMLElement;
	/** Flow container — mixed content segments and tool cards in streaming order */
	flowEl: HTMLElement;
	/** Currently active text segment (null after a tool card is inserted) */
	activeContentEl: HTMLElement | null;
	/** Buffer for the current text segment */
	segmentBuffer: string;
	/** Full accumulated text across all segments (for copy/persistence) */
	fullText: string;
	renderTimer: number | null;
	sourceUserText: string;
	typingEl: HTMLElement | null;
	thinkingBlockEl: HTMLElement | null;
	renderedToolIds: Set<string>;
}

export class MessageRenderer {
	private readonly app: App;
	private readonly component: Component;
	private containerEl: HTMLElement;
	private readonly actions: MessageActionHandlers;
	private readonly getSettings: () => RendererSettings;

	constructor(
		app: App,
		component: Component,
		containerEl: HTMLElement,
		actions: MessageActionHandlers,
		getSettings: () => RendererSettings
	) {
		this.app = app;
		this.component = component;
		this.containerEl = containerEl;
		this.actions = actions;
		this.getSettings = getSettings;
	}

	/** Switch the target container (used for per-tab DOM). */
	setContainer(el: HTMLElement): void {
		this.containerEl = el;
	}

	async addUserMessage(content: string): Promise<void> {
		const rowEl = this.containerEl.createDiv({ cls: "claude-agent-message-row claude-agent-message-row-user" });
		const msgEl = rowEl.createDiv({ cls: "claude-agent-message claude-agent-message-user" });

		/* Role icon */
		const iconEl = msgEl.createSpan({ cls: "claude-agent-role-icon claude-agent-role-user" });
		setIcon(iconEl, "user");

		const contentEl = msgEl.createDiv({ cls: "claude-agent-markdown" });
		await this.renderMarkdown(contentEl, content);
		renderUserActions(rowEl, content, this.actions);
	}

	startAssistantMessage(sourceUserText: string): AssistantBubbleState {
		const rowEl = this.containerEl.createDiv({ cls: "claude-agent-message-row claude-agent-message-row-assistant" });
		const wrapperEl = rowEl.createDiv({ cls: "claude-agent-message claude-agent-message-assistant" });

		/* Role icon */
		const iconEl = wrapperEl.createSpan({ cls: "claude-agent-role-icon claude-agent-role-assistant" });
		setIcon(iconEl, "bot");

		/* Flow container for interleaved content + tool cards */
		const flowEl = wrapperEl.createDiv({ cls: "claude-agent-flow" });

		/* Initial content segment */
		const contentEl = flowEl.createDiv({ cls: "claude-agent-markdown" });

		/* Typing indicator — 3 bouncing dots */
		const typingEl = contentEl.createDiv({ cls: "claude-agent-typing-indicator" });
		for (let i = 0; i < 3; i++) {
			typingEl.createSpan({ cls: "claude-agent-typing-dot" });
		}

		return {
			rowEl,
			wrapperEl,
			flowEl,
			activeContentEl: contentEl,
			segmentBuffer: "",
			fullText: "",
			renderTimer: null,
			sourceUserText,
			typingEl,
			thinkingBlockEl: null,
			renderedToolIds: new Set(),
		};
	}

	appendAssistantToken(state: AssistantBubbleState, token: string): void {
		/* Remove typing indicator on first real token */
		if (state.typingEl) {
			state.typingEl.remove();
			state.typingEl = null;
		}

		/* If no active content segment (e.g., after tool cards), create a new one */
		if (!state.activeContentEl) {
			state.activeContentEl = state.flowEl.createDiv({ cls: "claude-agent-markdown" });
			state.segmentBuffer = "";
		}

		state.segmentBuffer += token;
		state.fullText += token;

		const contentEl = state.activeContentEl;
		if (state.renderTimer !== null) {
			window.clearTimeout(state.renderTimer);
		}
		state.renderTimer = window.setTimeout(() => {
			state.renderTimer = null;
			void this.renderMarkdown(contentEl, state.segmentBuffer);
		}, 150);
	}

	/* ── Thinking stream ── */

	startThinking(state: AssistantBubbleState): void {
		/* Insert thinking block before flow content */
		const blockEl = ThinkingBlockRenderer.startThinking(state.wrapperEl);
		state.wrapperEl.insertBefore(blockEl, state.flowEl);
		state.thinkingBlockEl = blockEl;

		const settings = this.getSettings();
		if (settings.showDetailedThinking) {
			const contentEl = blockEl.querySelector(".claude-agent-thinking-content") as HTMLElement | null;
			if (contentEl) {
				contentEl.style.display = "";
			}
		}
	}

	appendThinkingToken(state: AssistantBubbleState, token: string): void {
		if (!state.thinkingBlockEl) {
			this.startThinking(state);
		}
		if (state.thinkingBlockEl) {
			ThinkingBlockRenderer.appendToken(state.thinkingBlockEl, token);
		}
	}

	finishThinking(state: AssistantBubbleState): void {
		if (state.thinkingBlockEl) {
			ThinkingBlockRenderer.finish(state.thinkingBlockEl);
			state.thinkingBlockEl = null;
		}
	}

	/* ── Live tool call ── */

	addLiveToolCall(state: AssistantBubbleState, toolCall: ToolCall): void {
		state.renderedToolIds.add(toolCall.id);

		/* Flush current segment before inserting tool card */
		if (state.activeContentEl && state.segmentBuffer) {
			if (state.renderTimer !== null) {
				window.clearTimeout(state.renderTimer);
				state.renderTimer = null;
			}
			void this.renderMarkdown(state.activeContentEl, state.segmentBuffer);
		}

		/* Remove empty content segment (no text streamed yet) */
		if (state.activeContentEl && !state.segmentBuffer.trim()) {
			state.activeContentEl.remove();
		}

		/* Append tool card to flow — it appears after the current text */
		renderToolCallCard(state.flowEl, toolCall, this.getSettings());

		/* Next token will create a new content segment */
		state.activeContentEl = null;
		state.segmentBuffer = "";
	}

	async finishAssistantMessage(
		state: AssistantBubbleState,
		content: string,
		toolCalls: ToolCall[] = []
	): Promise<void> {
		/* Remove typing indicator if still present */
		if (state.typingEl) {
			state.typingEl.remove();
			state.typingEl = null;
		}

		if (state.renderTimer !== null) {
			window.clearTimeout(state.renderTimer);
			state.renderTimer = null;
		}

		/* Final render of the active content segment */
		if (state.activeContentEl && state.segmentBuffer) {
			await this.renderMarkdown(state.activeContentEl, state.segmentBuffer);
		}

		/* Remove empty trailing content segment */
		if (state.activeContentEl && !state.segmentBuffer.trim()) {
			state.activeContentEl.remove();
		}

		/* Render tool calls that weren't already shown live */
		for (const toolCall of toolCalls) {
			if (!state.renderedToolIds.has(toolCall.id)) {
				renderToolCallCard(state.flowEl, toolCall, this.getSettings());
			}
		}

		/* Use provided content (accumulated across all turns) for action buttons */
		const displayText = content || state.fullText;
		renderAssistantActions(state.rowEl, displayText, state.sourceUserText, this.actions);
	}

	async restoreAssistantMessage(
		content: string,
		toolCalls: ToolCall[] = [],
		thinkingBlocks: ThinkingBlock[] = [],
		contentBlocks?: ContentBlock[],
	): Promise<void> {
		const rowEl = this.containerEl.createDiv({ cls: "claude-agent-message-row claude-agent-message-row-assistant" });
		const wrapperEl = rowEl.createDiv({ cls: "claude-agent-message claude-agent-message-assistant" });

		/* Role icon */
		const iconEl = wrapperEl.createSpan({ cls: "claude-agent-role-icon claude-agent-role-assistant" });
		setIcon(iconEl, "bot");

		/* Thinking blocks */
		for (const block of thinkingBlocks) {
			ThinkingBlockRenderer.render(wrapperEl, block.thinking, block.collapsed);
		}

		/* Flow container for tool calls + content */
		const flowEl = wrapperEl.createDiv({ cls: "claude-agent-flow" });

		if (contentBlocks && contentBlocks.length > 0) {
			/* Ordered rendering: preserve streaming interleave order */
			const toolCallMap = new Map(toolCalls.map(tc => [tc.id, tc]));
			for (const block of contentBlocks) {
				if (block.type === "text" && block.text.trim()) {
					const el = flowEl.createDiv({ cls: "claude-agent-markdown" });
					await this.renderMarkdown(el, block.text);
				} else if (block.type === "tool_call") {
					const tc = toolCallMap.get(block.toolCallId);
					if (tc) renderToolCallCard(flowEl, tc, this.getSettings());
				}
			}
		} else {
			/* Backward compat: old data without contentBlocks */
			for (const toolCall of toolCalls) {
				renderToolCallCard(flowEl, toolCall, this.getSettings());
			}
			if (content.trim()) {
				const contentEl = flowEl.createDiv({ cls: "claude-agent-markdown" });
				await this.renderMarkdown(contentEl, content);
			}
		}

		renderAssistantActions(rowEl, content, "", this.actions);
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
}

export type { AssistantBubbleState, RendererSettings };
