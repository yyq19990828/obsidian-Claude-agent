import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { PermissionMode } from "../types";

export class SectionSafety {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Safety" });

		new Setting(containerEl)
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

		new Setting(containerEl)
			.setName("Confirm file operations")
			.setDesc("Require approval before write or modify tool calls run.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.confirmFileOperations).onChange(async (value) => {
					plugin.settings.confirmFileOperations = value;
					await plugin.saveSettings();
				});
			});

		new Setting(containerEl)
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

		new Setting(containerEl)
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
