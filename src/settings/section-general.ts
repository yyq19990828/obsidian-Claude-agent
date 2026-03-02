import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";

export class SectionGeneral {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "General" });

		new Setting(containerEl)
			.setName("User name")
			.setDesc("Your name, shown in chat messages.")
			.addText((text) => {
				text
					.setPlaceholder("(optional)")
					.setValue(plugin.settings.userName)
					.onChange(async (value) => {
						plugin.settings.userName = value.trim();
						await plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Auto-scroll")
			.setDesc("Automatically scroll to the latest message.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.autoScroll).onChange(async (value) => {
					plugin.settings.autoScroll = value;
					await plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Auto-generate title")
			.setDesc("Automatically generate a title for new conversations based on the first message.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.autoGenerateTitle).onChange(async (value) => {
					plugin.settings.autoGenerateTitle = value;
					await plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Detailed thinking")
			.setDesc("Show thinking content expanded in real-time. When off, only the label is shown.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.showDetailedThinking).onChange(async (value) => {
					plugin.settings.showDetailedThinking = value;
					await plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Detailed tool calls")
			.setDesc("Allow expanding tool calls to see input parameters and results.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.showDetailedTools).onChange(async (value) => {
					plugin.settings.showDetailedTools = value;
					await plugin.saveSettings();
				});
			});
	}
}
