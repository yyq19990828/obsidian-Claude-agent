import { MODELS } from "../../constants";

export interface InputToolbarConfig {
	getSettings: () => { model: string; thinkingBudget: string; permissionMode: string };
	onModelChange: (model: string) => void;
	onThinkingChange: (budget: string) => void;
	onPermissionChange: (mode: string) => void;
}

export class InputToolbar {
	private containerEl: HTMLElement;
	private modelSelect: HTMLSelectElement;
	private thinkingSelect: HTMLSelectElement;
	private permissionSelect: HTMLSelectElement;

	constructor(parentEl: HTMLElement, private readonly config: InputToolbarConfig) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-input-toolbar" });

		/* Model selector */
		const modelGroup = this.containerEl.createDiv({ cls: "claude-agent-toolbar-group" });
		modelGroup.createSpan({ cls: "claude-agent-toolbar-label", text: "Model" });
		this.modelSelect = modelGroup.createEl("select", { cls: "claude-agent-toolbar-select" });
		for (const m of MODELS) {
			this.modelSelect.createEl("option", { value: m.id, text: m.label });
		}

		/* Thinking budget */
		const thinkingGroup = this.containerEl.createDiv({ cls: "claude-agent-toolbar-group" });
		thinkingGroup.createSpan({ cls: "claude-agent-toolbar-label", text: "Thinking" });
		this.thinkingSelect = thinkingGroup.createEl("select", { cls: "claude-agent-toolbar-select" });
		for (const [value, label] of [["off", "Off"], ["normal", "Normal"], ["extended", "Extended"]]) {
			this.thinkingSelect.createEl("option", { value, text: label });
		}

		/* Permission mode */
		const permGroup = this.containerEl.createDiv({ cls: "claude-agent-toolbar-group" });
		permGroup.createSpan({ cls: "claude-agent-toolbar-label", text: "Permissions" });
		this.permissionSelect = permGroup.createEl("select", { cls: "claude-agent-toolbar-select" });
		for (const [value, label] of [["auto_approve", "Auto"], ["confirm", "Confirm"], ["plan_only", "Plan only"]]) {
			this.permissionSelect.createEl("option", { value, text: label });
		}

		this.syncFromSettings();

		this.modelSelect.addEventListener("change", () => {
			this.config.onModelChange(this.modelSelect.value);
		});
		this.thinkingSelect.addEventListener("change", () => {
			this.config.onThinkingChange(this.thinkingSelect.value);
		});
		this.permissionSelect.addEventListener("change", () => {
			this.config.onPermissionChange(this.permissionSelect.value);
		});
	}

	syncFromSettings(): void {
		const s = this.config.getSettings();
		this.modelSelect.value = s.model;
		this.thinkingSelect.value = s.thinkingBudget;
		this.permissionSelect.value = s.permissionMode;
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
