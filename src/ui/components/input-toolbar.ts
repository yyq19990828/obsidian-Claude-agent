import { MODELS } from "../../constants";
import type { ThinkingBudget, PermissionMode } from "../../types";

export interface InputToolbarConfig {
	getSettings: () => { model: string; thinkingBudget: ThinkingBudget; permissionMode: PermissionMode };
	onModelChange: (model: string) => void;
	onThinkingChange: (budget: ThinkingBudget) => void;
	onPermissionChange: (mode: PermissionMode) => void;
}

export class InputToolbar {
	private modelSelect: HTMLSelectElement;
	private thinkingSelect: HTMLSelectElement;

	/**
	 * Renders compact inline selectors directly into a parent container
	 * (intended to be injected into the input area's bottom bar).
	 */
	constructor(parentEl: HTMLElement, private readonly config: InputToolbarConfig) {
		/* Model selector: compact button-style */
		const modelGroup = parentEl.createDiv({ cls: "claude-agent-toolbar-group" });
		this.modelSelect = modelGroup.createEl("select", { cls: "claude-agent-toolbar-select" });
		for (const m of MODELS) {
			this.modelSelect.createEl("option", { value: m.id, text: m.label });
		}

		/* Thinking selector */
		const thinkingGroup = parentEl.createDiv({ cls: "claude-agent-toolbar-group" });
		thinkingGroup.createSpan({ cls: "claude-agent-toolbar-label", text: "Thinking:" });
		this.thinkingSelect = thinkingGroup.createEl("select", {
			cls: "claude-agent-toolbar-select claude-agent-toolbar-accent",
		});
		for (const [value, label] of [["off", "Off"], ["normal", "Normal"], ["extended", "Extended"]]) {
			this.thinkingSelect.createEl("option", { value, text: label });
		}

		this.syncFromSettings();

		this.modelSelect.addEventListener("change", () => {
			this.config.onModelChange(this.modelSelect.value);
		});
		this.thinkingSelect.addEventListener("change", () => {
			this.config.onThinkingChange(this.thinkingSelect.value as ThinkingBudget);
		});
	}

	syncFromSettings(): void {
		const s = this.config.getSettings();
		this.modelSelect.value = s.model;
		this.thinkingSelect.value = s.thinkingBudget;
	}

	destroy(): void {
		/* No container to remove — elements are owned by parent */
	}
}
