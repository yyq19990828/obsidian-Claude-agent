import { setIcon } from "obsidian";

export interface InputAreaConfig {
	onSend: (text: string) => void;
	onStop: () => void;
}

export class InputArea {
	readonly containerEl: HTMLElement;
	private textareaEl: HTMLTextAreaElement;
	private sendButtonEl: HTMLButtonElement;
	private stopButtonEl: HTMLButtonElement;
	private hintEl: HTMLElement;
	readonly bottomBarEl: HTMLElement;
	private _isStreaming = false;

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
