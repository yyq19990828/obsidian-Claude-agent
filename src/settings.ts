import { App, PluginSettingTab, Setting } from "obsidian";
import type ClaudeAgentPlugin from "./main";
import type { ClaudeAgentSettings } from "./types";

export const DEFAULT_SETTINGS: ClaudeAgentSettings = {
	apiKey: "",
	authMethod: "api_key",
	maxContextSize: 50_000,
	confirmFileOperations: true,
	model: "claude-sonnet-4-6",
};

export class ClaudeAgentSettingTab extends PluginSettingTab {
	plugin: ClaudeAgentPlugin;

	constructor(app: App, plugin: ClaudeAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Authentication method")
			.setDesc("Choose how to authenticate.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("api_key", "API key")
					.addOption("claude_code", "Claude code")
					.setValue(this.plugin.settings.authMethod)
					.onChange(async (value) => {
						this.plugin.settings.authMethod = value as ClaudeAgentSettings["authMethod"];
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Used when authentication method is set to API key.")
			.addText((text) => {
				text
					.setPlaceholder("Enter key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
				text.inputEl.disabled = this.plugin.settings.authMethod !== "api_key";
			});

		new Setting(containerEl)
			.setName("Max context size")
			.setDesc("Maximum active-note characters attached to each message.")
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.maxContextSize))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.maxContextSize = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SETTINGS.maxContextSize;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Confirm file operations")
			.setDesc("Require approval before write or modify tool calls run.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.confirmFileOperations).onChange(async (value) => {
					this.plugin.settings.confirmFileOperations = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Claude model used for chat responses.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("claude-sonnet-4-6", "Claude sonnet 4.6")
					.addOption("claude-opus-4-1", "Claude opus 4.1")
					.addOption("claude-3-7-sonnet-latest", "Claude 3.7 sonnet")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
