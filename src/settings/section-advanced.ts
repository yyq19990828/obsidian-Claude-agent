import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import { DEFAULT_SETTINGS } from "../constants";

export class SectionAdvanced {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Advanced" });

		new Setting(containerEl)
			.setName("Max context size")
			.setDesc("Maximum active-note characters attached to each message.")
			.addText((text) => {
				text
					.setValue(String(plugin.settings.maxContextSize))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						plugin.settings.maxContextSize = Number.isFinite(parsed) && parsed > 0
							? parsed
							: DEFAULT_SETTINGS.maxContextSize;
						await plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Max messages per conversation")
			.setDesc("Older messages are trimmed to stay within this limit.")
			.addText((text) => {
				text
					.setValue(String(plugin.settings.maxMessagesPerConversation))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						plugin.settings.maxMessagesPerConversation = Number.isFinite(parsed) && parsed > 0
							? parsed
							: DEFAULT_SETTINGS.maxMessagesPerConversation;
						await plugin.saveSettings();
					});
			});
	}
}
