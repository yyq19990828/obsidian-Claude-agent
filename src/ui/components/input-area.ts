import { setIcon } from "obsidian";

export interface InputAreaConfig {
	onSend: (text: string) => void;
	onStop: () => void;
}

export class InputArea {
	private containerEl: HTMLElement;
	private textareaEl: HTMLTextAreaElement;
	private sendButtonEl: HTMLButtonElement;
	private stopButtonEl: HTMLButtonElement;
	private _isStreaming = false;

	constructor(parentEl: HTMLElement, private readonly config: InputAreaConfig) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-input-wrap" });

		this.textareaEl = this.containerEl.createEl("textarea", {
			cls: "claude-agent-input",
			attr: { placeholder: "Ask about your current note...", rows: "3" },
		});

		const btnGroup = this.containerEl.createDiv({ cls: "claude-agent-input-buttons" });

		this.sendButtonEl = btnGroup.createEl("button", {
			cls: "mod-cta claude-agent-send",
			attr: { "aria-label": "Send message" },
		});
		setIcon(this.sendButtonEl, "send");
		this.sendButtonEl.createSpan({ text: "Send" });

		this.stopButtonEl = btnGroup.createEl("button", {
			cls: "claude-agent-stop",
			attr: { "aria-label": "Stop generation" },
		});
		setIcon(this.stopButtonEl, "square");
		this.stopButtonEl.createSpan({ text: "Stop" });
		this.stopButtonEl.style.display = "none";

		this.sendButtonEl.addEventListener("click", () => this.handleSend());
		this.stopButtonEl.addEventListener("click", () => this.config.onStop());

		this.textareaEl.addEventListener("keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter" && !evt.shiftKey) {
				evt.preventDefault();
				this.handleSend();
			}
		});
	}

	private handleSend(): void {
		const text = this.textareaEl.value.trim();
		if (!text || this._isStreaming) return;
		this.textareaEl.value = "";
		this.autoResize();
		this.config.onSend(text);
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
		this.containerEl.remove();
	}
}
