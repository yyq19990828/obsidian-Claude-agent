import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { ClaudeAgentSettings } from "../types";

export class SectionAuth {
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
						// Re-render to update disabled states
						const settingTab = (plugin.app as unknown as Record<string, unknown>).setting as { activeTab?: { display(): void } } | undefined;
						if (settingTab?.activeTab) settingTab.activeTab.display();
					});
			});

		new Setting(containerEl)
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
				text.inputEl.disabled = plugin.settings.authMethod !== "api_key";
			});

		new Setting(containerEl)
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
				text.inputEl.disabled = plugin.settings.authMethod !== "claude_code";
			});
	}
}
