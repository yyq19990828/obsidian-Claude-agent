import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { ClaudeAgentSettings } from "../types";

export class SectionAuth {
	private apiKeySetting!: Setting;
	private cliPathSetting!: Setting;

	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Authentication" });

		new Setting(containerEl)
			.setName("Authentication method")
			.setDesc("Choose how to authenticate with Claude.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("api_key", "API key")
					.addOption("claude_code", "Claude Code (subscription)")
					.setValue(plugin.settings.authMethod)
					.onChange(async (value) => {
						plugin.settings.authMethod = value as ClaudeAgentSettings["authMethod"];
						await plugin.saveSettings();
						this.updateDisabledStates(plugin);
					});
			});

		this.apiKeySetting = new Setting(containerEl)
			.setName("API key")
			.setDesc("Used when authentication method is set to API key.")
			.addText((text) => {
				text
					.setPlaceholder("sk-ant-...")
					.setValue(plugin.settings.apiKey)
					.onChange(async (value) => {
						plugin.settings.apiKey = value.trim();
						await plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		this.cliPathSetting = new Setting(containerEl)
			.setName("Claude CLI path")
			.setDesc("Path to the claude executable. Leave empty for auto-detection.")
			.addText((text) => {
				text
					.setPlaceholder("~/.local/bin/claude")
					.setValue(plugin.settings.claudeCliPath)
					.onChange(async (value) => {
						plugin.settings.claudeCliPath = value.trim();
						await plugin.saveSettings();
					});
			});

		this.updateDisabledStates(plugin);
	}

	private updateDisabledStates(plugin: ClaudeAgentPlugin): void {
		const apiKeyInput = this.apiKeySetting.controlEl.querySelector("input");
		const cliPathInput = this.cliPathSetting.controlEl.querySelector("input");
		if (apiKeyInput) apiKeyInput.disabled = plugin.settings.authMethod !== "api_key";
		if (cliPathInput) cliPathInput.disabled = plugin.settings.authMethod !== "claude_code";
	}
}
