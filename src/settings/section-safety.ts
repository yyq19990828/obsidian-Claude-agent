import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { PermissionMode } from "../types";
import { requestSuperModeConfirmation } from "../ui/modals/super-mode-confirm-modal";

export class SectionSafety {
	private plugin: ClaudeAgentPlugin;
	private wrapperEl: HTMLElement;
	private onSafeModeChanged?: () => void;

	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin, onSafeModeChanged?: () => void) {
		this.plugin = plugin;
		this.onSafeModeChanged = onSafeModeChanged;
		this.wrapperEl = containerEl.createDiv();
		this.render();
	}

	private render(): void {
		const { wrapperEl, plugin } = this;
		wrapperEl.empty();
		wrapperEl.createEl("h2", { text: "Safety" });

		new Setting(wrapperEl)
			.setName("Permission mode")
			.setDesc("Controls how tool calls are approved.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto_approve", "Auto approve")
					.addOption("confirm", "Confirm each action")
					.addOption("plan_only", "Plan only (no execution)")
					.setValue(plugin.settings.permissionMode)
					.onChange(async (value) => {
						plugin.settings.permissionMode = value as PermissionMode;
						await plugin.saveSettings();
					});
			});

		new Setting(wrapperEl)
			.setName("Confirm file operations")
			.setDesc("Require approval before write or modify tool calls run.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.confirmFileOperations).onChange(async (value) => {
					plugin.settings.confirmFileOperations = value;
					await plugin.saveSettings();
				});
			});

		/* ── Safe / Super mode ── */

		wrapperEl.createEl("h3", { text: "SDK access mode" });

		new Setting(wrapperEl)
			.setName("Safe mode")
			.setDesc("When enabled, only vault-scoped MCP tools are available. Disable to access SDK built-in tools and .claude/ configuration.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.safeMode).onChange(async (value) => {
					if (!value) {
						const confirmed = await requestSuperModeConfirmation(plugin.app);
						if (!confirmed) {
							toggle.setValue(true);
							return;
						}
						plugin.settings.safeMode = false;
					} else {
						plugin.settings.safeMode = true;
					}
					await plugin.saveSettings();
					this.render();
					this.onSafeModeChanged?.();
				});
			});

		/* ── Restrictions ── */

		wrapperEl.createEl("h3", { text: "Restrictions" });

		new Setting(wrapperEl)
			.setName("Command blacklist")
			.setDesc("Comma-separated list of commands the agent should never execute.")
			.addTextArea((text) => {
				text
					.setPlaceholder("rm -rf, git push --force")
					.setValue(plugin.settings.commandBlacklist.join(", "))
					.onChange(async (value) => {
						plugin.settings.commandBlacklist = value
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean);
						await plugin.saveSettings();
					});
				text.inputEl.rows = 3;
			});

		new Setting(wrapperEl)
			.setName("Allowed paths")
			.setDesc("Restrict file operations to these vault paths. One per line. Leave empty to allow all.")
			.addTextArea((text) => {
				text
					.setPlaceholder("notes/\ntemplates/")
					.setValue(plugin.settings.allowedPaths.join("\n"))
					.onChange(async (value) => {
						plugin.settings.allowedPaths = value
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean);
						await plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});
	}

}
