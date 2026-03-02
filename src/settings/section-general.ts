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
	}
}
