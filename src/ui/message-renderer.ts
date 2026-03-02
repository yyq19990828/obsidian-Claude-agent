import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import { ThinkingBlockRenderer } from "./components/thinking-block";
import type { ToolCall } from "../types";

interface RendererSettings {
	showDetailedThinking: boolean;
	showDetailedTools: boolean;
}

interface AssistantBubbleState {
	rowEl: HTMLElement;
	wrapperEl: HTMLElement;
	toolContainerEl: HTMLElement;
	contentEl: HTMLElement;
	buffer: string;
	renderTimer: number | null;
	sourceUserText: string;
	typingEl: HTMLElement | null;
	thinkingBlockEl: HTMLElement | null;
	renderedToolIds: Set<string>;
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

		/* Tool cards container — sits above text content so tools appear
		   in chronological order (tools execute, then model explains). */
		const toolContainerEl = wrapperEl.createDiv({ cls: "claude-agent-tool-container" });

		const contentEl = wrapperEl.createDiv({ cls: "claude-agent-markdown" });

		/* Typing indicator — 3 bouncing dots */
		const typingEl = contentEl.createDiv({ cls: "claude-agent-typing-indicator" });
		for (let i = 0; i < 3; i++) {
			typingEl.createSpan({ cls: "claude-agent-typing-dot" });
		}

		return {
			rowEl,
			wrapperEl,
			toolContainerEl,
			contentEl,
			buffer: "",
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

		state.buffer += token;
		if (state.renderTimer !== null) {
			window.clearTimeout(state.renderTimer);
		}
		state.renderTimer = window.setTimeout(() => {
			void this.renderMarkdown(state.contentEl, state.buffer);
			state.renderTimer = null;
		}, 70);
	}

	/* ── Thinking stream ── */

	startThinking(state: AssistantBubbleState): void {
		/* Each thinking round gets its own block — no reuse guard.
		   Insert before toolContainerEl so the timeline order is:
		   [thinking-1] [tools-1] [thinking-2] [tools-2] … [text] */
		const blockEl = ThinkingBlockRenderer.startThinking(state.wrapperEl);
		state.wrapperEl.insertBefore(blockEl, state.toolContainerEl);
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
			/* Reset so the next thinking round creates a fresh block */
			state.thinkingBlockEl = null;
		}
	}

	/* ── Live tool call ── */

	addLiveToolCall(state: AssistantBubbleState, toolCall: ToolCall): void {
		state.renderedToolIds.add(toolCall.id);
		this.renderToolCallCard(state.toolContainerEl, toolCall);
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

		state.buffer = content || state.buffer;
		await this.renderMarkdown(state.contentEl, state.buffer);

		/* Only render tool calls that weren't already shown live */
		for (const toolCall of toolCalls) {
			if (!state.renderedToolIds.has(toolCall.id)) {
				this.renderToolCallCard(state.toolContainerEl, toolCall);
			}
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
		const settings = this.getSettings();
		const row = parentEl.createDiv({ cls: `claude-agent-tool-card is-${toolCall.status}` });

		const iconEl = row.createSpan({ cls: "claude-agent-tool-icon" });
		const iconName = this.getToolIcon(toolCall.toolName);
		setIcon(iconEl, iconName);

		const label = toolCall.filePath
			? `${toolCall.toolName}: ${this.truncatePath(toolCall.filePath)}`
			: toolCall.toolName;
		row.createSpan({ cls: "claude-agent-tool-name", text: label });

		const statusEl = row.createSpan({ cls: "claude-agent-tool-status" });
		if (toolCall.status === "executed") {
			statusEl.setText("✓");
			statusEl.addClass("is-executed");
		} else if (toolCall.status === "pending") {
			statusEl.setText("···");
			statusEl.addClass("is-pending");
		} else {
			statusEl.setText("✕");
			statusEl.addClass("is-rejected");
		}

		/* Detailed mode: expanded by default, clickable to collapse */
		if (settings.showDetailedTools) {
			row.addClass("claude-agent-tool-card-expandable");
			const detailEl = parentEl.createDiv({ cls: "claude-agent-tool-detail" });

			/* Input params */
			if (toolCall.input && Object.keys(toolCall.input).length > 0) {
				const paramsEl = detailEl.createDiv({ cls: "claude-agent-tool-detail-section" });
				paramsEl.createEl("strong", { text: "Input:" });
				const pre = paramsEl.createEl("pre", { cls: "claude-agent-tool-detail-pre" });
				pre.setText(JSON.stringify(toolCall.input, null, 2));
			}

			/* Result */
			if (toolCall.result) {
				const resultEl = detailEl.createDiv({ cls: "claude-agent-tool-detail-section" });
				resultEl.createEl("strong", { text: "Result:" });
				const pre = resultEl.createEl("pre", { cls: "claude-agent-tool-detail-pre" });
				pre.setText(typeof toolCall.result === "string" ? toolCall.result : JSON.stringify(toolCall.result, null, 2));
			}

			row.addEventListener("click", () => {
				const isHidden = detailEl.style.display === "none";
				detailEl.style.display = isHidden ? "" : "none";
			});
		}
	}

	private getToolIcon(toolName: string): string {
		const lower = toolName.toLowerCase();
		if (lower.includes("read")) return "file-text";
		if (lower.includes("write")) return "file-plus";
		if (lower.includes("edit")) return "file-edit";
		if (lower.includes("bash")) return "terminal";
		if (lower.includes("glob")) return "search";
		if (lower.includes("grep")) return "search";
		if (lower.includes("web")) return "globe";
		return "wrench";
	}

	private truncatePath(filePath: string): string {
		if (filePath.length <= 40) return filePath;
		const parts = filePath.split("/");
		if (parts.length <= 2) return "..." + filePath.slice(-37);
		return ".../" + parts.slice(-2).join("/");
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

export type { AssistantBubbleState, RendererSettings };
