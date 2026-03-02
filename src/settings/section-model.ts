import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import { MODELS } from "../constants";
import type { ThinkingBudget } from "../types";

export class SectionModel {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Model" });

		new Setting(containerEl)
			.setName("Default model")
			.setDesc("Claude model used for chat responses.")
			.addDropdown((dropdown) => {
				for (const m of MODELS) {
					dropdown.addOption(m.id, m.label);
				}
				dropdown.setValue(plugin.settings.model).onChange(async (value) => {
					plugin.settings.model = value;
					await plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Thinking budget")
			.setDesc("Controls extended thinking. Higher budgets produce more thorough reasoning.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("off", "Off")
					.addOption("normal", "Normal (10k tokens)")
					.addOption("extended", "Extended (50k tokens)")
					.setValue(plugin.settings.thinkingBudget)
					.onChange(async (value) => {
						plugin.settings.thinkingBudget = value as ThinkingBudget;
						await plugin.saveSettings();
					});
			});
	}
}
