import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { SlashCommand } from "../types";

export class SectionCommands {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Slash commands" });

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Define custom slash commands that expand into prompts.",
		});

		const listEl = containerEl.createDiv({ cls: "claude-agent-commands-list" });
		this.renderList(listEl, plugin);

		new Setting(containerEl).addButton((btn) => {
			btn.setButtonText("Add command").onClick(() => {
				const cmd: SlashCommand = {
					id: crypto.randomUUID(),
					name: "",
					prompt: "",
				};
				plugin.settings.slashCommands.push(cmd);
				void plugin.saveSettings();
				this.renderList(listEl, plugin);
			});
		});
	}

	private renderList(listEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		listEl.empty();

		if (plugin.settings.slashCommands.length === 0) {
			listEl.createDiv({ cls: "claude-agent-commands-empty", text: "No custom commands." });
			return;
		}

		for (const cmd of plugin.settings.slashCommands) {
			this.renderCommand(listEl, cmd, plugin);
		}
	}

	private renderCommand(listEl: HTMLElement, cmd: SlashCommand, plugin: ClaudeAgentPlugin): void {
		const card = listEl.createDiv({ cls: "claude-agent-command-card" });

		new Setting(card)
			.setName("Command name")
			.addText((text) => {
				text
					.setPlaceholder("/summarize")
					.setValue(cmd.name)
					.onChange(async (value) => {
						cmd.name = value.trim();
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Prompt template")
			.addTextArea((text) => {
				text
					.setPlaceholder("Summarize the current note in 3 bullet points.")
					.setValue(cmd.prompt)
					.onChange(async (value) => {
						cmd.prompt = value;
						await plugin.saveSettings();
					});
				text.inputEl.rows = 3;
			});

		new Setting(card).addButton((btn) => {
			btn
				.setButtonText("Remove")
				.setWarning()
				.onClick(async () => {
					plugin.settings.slashCommands = plugin.settings.slashCommands.filter((c) => c.id !== cmd.id);
					await plugin.saveSettings();
					card.remove();
				});
		});
	}
}
