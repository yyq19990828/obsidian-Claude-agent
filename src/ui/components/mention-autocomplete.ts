import { setIcon } from "obsidian";
import type { VaultFileEntry } from "../../types";

export interface MentionSuggestion {
	type: "file" | "folder" | "agent";
	label: string;
	path: string;
	icon: string;
}

export interface MentionAutocompleteConfig {
	getFileSuggestions: (query: string) => MentionSuggestion[];
	getAgentSuggestions?: (query: string) => MentionSuggestion[];
	onSelect: (suggestion: MentionSuggestion) => void;
}

const MAX_SUGGESTIONS = 20;

export class MentionAutocomplete {
	private dropdownEl: HTMLElement | null = null;
	private suggestions: MentionSuggestion[] = [];
	private selectedIndex = 0;
	private active = false;
	private mentionStart = -1;
	private parentEl: HTMLElement;

	constructor(
		parentEl: HTMLElement,
		private readonly textareaEl: HTMLTextAreaElement,
		private readonly config: MentionAutocompleteConfig,
	) {
		this.parentEl = parentEl;
		this.textareaEl.addEventListener("input", () => this.onInput());
		this.textareaEl.addEventListener("keydown", (e) => this.onKeyDown(e));
		this.textareaEl.addEventListener("blur", () => {
			/* Delay close to allow click on dropdown */
			setTimeout(() => this.close(), 150);
		});
	}

	/** List of currently selected mention paths. */
	private selectedMentions: MentionSuggestion[] = [];

	getSelectedMentions(): MentionSuggestion[] {
		return [...this.selectedMentions];
	}

	clearMentions(): void {
		this.selectedMentions = [];
	}

	private onInput(): void {
		const value = this.textareaEl.value;
		const cursorPos = this.textareaEl.selectionStart;

		/* Find the last @ before cursor */
		let atPos = -1;
		for (let i = cursorPos - 1; i >= 0; i--) {
			const ch = value.charAt(i);
			if (ch === "@") {
				/* Ensure @ is at start or preceded by whitespace */
				if (i === 0 || /\s/.test(value.charAt(i - 1))) {
					atPos = i;
					break;
				}
			}
			/* Stop if we hit whitespace before finding @ */
			if (/\s/.test(ch) && ch !== "@") break;
		}

		if (atPos === -1) {
			this.close();
			return;
		}

		const query = value.slice(atPos + 1, cursorPos);
		this.mentionStart = atPos;
		this.show(query);
	}

	private show(query: string): void {
		const fileSuggestions = this.config.getFileSuggestions(query);
		const agentSuggestions = this.config.getAgentSuggestions?.(query) ?? [];
		this.suggestions = [...agentSuggestions, ...fileSuggestions].slice(0, MAX_SUGGESTIONS);

		if (this.suggestions.length === 0) {
			this.close();
			return;
		}

		this.active = true;
		this.selectedIndex = 0;

		if (!this.dropdownEl) {
			this.dropdownEl = this.parentEl.createDiv({ cls: "claude-agent-mention-dropdown" });
		}

		this.renderDropdown();
	}

	private renderDropdown(): void {
		if (!this.dropdownEl) return;
		this.dropdownEl.empty();

		for (let i = 0; i < this.suggestions.length; i++) {
			const s = this.suggestions[i]!;
			const item = this.dropdownEl.createDiv({
				cls: `claude-agent-mention-item ${i === this.selectedIndex ? "is-selected" : ""}`,
			});

			const iconEl = item.createSpan({ cls: "claude-agent-mention-icon" });
			setIcon(iconEl, s.icon);
			item.createSpan({ cls: "claude-agent-mention-label", text: s.label });
			if (s.type !== "agent" && s.path !== s.label) {
				item.createSpan({ cls: "claude-agent-mention-path", text: s.path });
			}

			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.selectItem(i);
			});

			item.addEventListener("mouseenter", () => {
				this.selectedIndex = i;
				this.renderDropdown();
			});
		}
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (!this.active) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
				this.renderDropdown();
				break;
			case "ArrowUp":
				e.preventDefault();
				this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
				this.renderDropdown();
				break;
			case "Enter":
			case "Tab":
				if (this.suggestions.length > 0) {
					e.preventDefault();
					this.selectItem(this.selectedIndex);
				}
				break;
			case "Escape":
				e.preventDefault();
				this.close();
				break;
		}
	}

	private selectItem(index: number): void {
		const suggestion = this.suggestions[index];
		if (!suggestion) return;

		/* Replace the @query with @path in textarea */
		const value = this.textareaEl.value;
		const before = value.slice(0, this.mentionStart);
		const cursorPos = this.textareaEl.selectionStart;
		const after = value.slice(cursorPos);
		const insertion = `@${suggestion.path} `;
		this.textareaEl.value = before + insertion + after;
		this.textareaEl.selectionStart = this.textareaEl.selectionEnd = before.length + insertion.length;

		/* Track the mention */
		this.selectedMentions.push(suggestion);
		this.config.onSelect(suggestion);

		this.close();

		/* Trigger input event for auto-resize */
		this.textareaEl.dispatchEvent(new Event("input"));
	}

	private close(): void {
		this.active = false;
		this.suggestions = [];
		if (this.dropdownEl) {
			this.dropdownEl.remove();
			this.dropdownEl = null;
		}
	}

	destroy(): void {
		this.close();
	}
}

/** Convert VaultFileEntry to MentionSuggestion. */
export function fileEntryToSuggestion(entry: VaultFileEntry): MentionSuggestion {
	const icon = entry.extension === "md" ? "file-text" : "file";
	return {
		type: "file",
		label: entry.basename,
		path: entry.path,
		icon,
	};
}

export function folderToSuggestion(folderPath: string): MentionSuggestion {
	const name = folderPath.split("/").pop() ?? folderPath;
	return {
		type: "folder",
		label: name,
		path: folderPath,
		icon: "folder",
	};
}
