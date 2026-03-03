import { setIcon } from "obsidian";
import { MentionAutocomplete, type MentionSuggestion, type MentionAutocompleteConfig } from "./mention-autocomplete";

export interface InputAreaConfig {
	onSend: (text: string, mentions?: MentionSuggestion[]) => void;
	onStop: () => void;
	mentionConfig?: MentionAutocompleteConfig;
}

export class InputArea {
	readonly containerEl: HTMLElement;
	private textareaEl: HTMLTextAreaElement;
	private sendButtonEl: HTMLButtonElement;
	private stopButtonEl: HTMLButtonElement;
	private hintEl: HTMLElement;
	readonly bottomBarEl: HTMLElement;
	private _isStreaming = false;
	private mentionAutocomplete: MentionAutocomplete | null = null;
	private contextCounterEl: HTMLElement | null = null;

	constructor(parentEl: HTMLElement, private readonly config: InputAreaConfig) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-input-container" });

		this.textareaEl = this.containerEl.createEl("textarea", {
			cls: "claude-agent-input",
			attr: { placeholder: "Ask Claude anything...", rows: "2" },
		});

		this.hintEl = this.containerEl.createDiv({ cls: "claude-agent-input-hint" });
		this.hintEl.setText("Enter to send, Shift+Enter for newline");

		this.bottomBarEl = this.containerEl.createDiv({ cls: "claude-agent-input-bottom-bar" });

		/* Spacer pushes send/stop to the right */
		this.bottomBarEl.createDiv({ cls: "claude-agent-bottom-bar-spacer" });

		this.sendButtonEl = this.bottomBarEl.createEl("button", {
			cls: "claude-agent-send-icon",
			attr: { "aria-label": "Send message", type: "button" },
		});
		setIcon(this.sendButtonEl, "arrow-up");

		this.stopButtonEl = this.bottomBarEl.createEl("button", {
			cls: "claude-agent-stop-icon",
			attr: { "aria-label": "Stop generation", type: "button" },
		});
		setIcon(this.stopButtonEl, "square");
		this.stopButtonEl.style.display = "none";

		this.sendButtonEl.addEventListener("click", () => this.handleSend());
		this.stopButtonEl.addEventListener("click", () => this.config.onStop());

		this.textareaEl.addEventListener("keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter" && !evt.shiftKey) {
				evt.preventDefault();
				this.handleSend();
			}
		});

		this.textareaEl.addEventListener("input", () => this.autoResize());

		/* Mention autocomplete */
		if (config.mentionConfig) {
			this.mentionAutocomplete = new MentionAutocomplete(
				this.containerEl,
				this.textareaEl,
				config.mentionConfig,
			);
		}
	}

	private handleSend(): void {
		const text = this.textareaEl.value.trim();
		if (!text || this._isStreaming) return;
		const mentions = this.mentionAutocomplete?.getSelectedMentions();
		this.textareaEl.value = "";
		this.autoResize();
		this.mentionAutocomplete?.clearMentions();
		this.config.onSend(text, mentions);
	}

	/** Update context counter display (tokens used / max). */
	updateContextCounter(usedTokens: number, maxTokens: number): void {
		if (!this.contextCounterEl) {
			this.contextCounterEl = this.bottomBarEl.createDiv({ cls: "claude-agent-context-counter" });
			/* Insert before the spacer */
			const spacer = this.bottomBarEl.querySelector(".claude-agent-bottom-bar-spacer");
			if (spacer) spacer.before(this.contextCounterEl);
		}

		const formatted = `~${this.formatCount(usedTokens)} / ${this.formatCount(maxTokens)}`;
		this.contextCounterEl.setText(formatted);

		const ratio = usedTokens / maxTokens;
		this.contextCounterEl.classList.toggle("is-warning", ratio >= 0.8 && ratio < 0.95);
		this.contextCounterEl.classList.toggle("is-danger", ratio >= 0.95);
	}

	private formatCount(n: number): string {
		if (n >= 1000) return (n / 1000).toFixed(1) + "k";
		return String(n);
	}

	setStreaming(streaming: boolean): void {
		this._isStreaming = streaming;
		this.sendButtonEl.style.display = streaming ? "none" : "";
		this.stopButtonEl.style.display = streaming ? "" : "none";
		this.textareaEl.disabled = streaming;
	}

	focus(): void {
		this.textareaEl.focus();
	}

	private autoResize(): void {
		this.textareaEl.style.height = "auto";
		this.textareaEl.style.height = Math.min(this.textareaEl.scrollHeight, 180) + "px";
	}

	destroy(): void {
		this.mentionAutocomplete?.destroy();
		this.containerEl.remove();
	}
}
