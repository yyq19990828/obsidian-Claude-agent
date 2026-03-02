import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";

export class SectionEnvironment {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Environment variables" });

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Custom environment variables passed to the Claude Agent SDK process.",
		});

		const listEl = containerEl.createDiv({ cls: "claude-agent-env-list" });
		this.renderList(listEl, plugin);

		new Setting(containerEl).addButton((btn) => {
			btn.setButtonText("Add variable").onClick(() => {
				plugin.settings.envVars["NEW_VAR"] = "";
				void plugin.saveSettings();
				this.renderList(listEl, plugin);
			});
		});
	}

	private renderList(listEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		listEl.empty();

		const entries = Object.entries(plugin.settings.envVars);
		if (entries.length === 0) {
			listEl.createDiv({ cls: "claude-agent-env-empty", text: "No custom environment variables." });
			return;
		}

		for (const [key, value] of entries) {
			this.renderEntry(listEl, key, value, plugin);
		}
	}

	private renderEntry(listEl: HTMLElement, key: string, value: string, plugin: ClaudeAgentPlugin): void {
		const row = listEl.createDiv({ cls: "claude-agent-env-row" });

		const keyInput = row.createEl("input", {
			cls: "claude-agent-env-key",
			attr: { type: "text", value: key, placeholder: "KEY" },
		});

		const valueInput = row.createEl("input", {
			cls: "claude-agent-env-value",
			attr: { type: "text", value, placeholder: "value" },
		});

		const removeBtn = row.createEl("button", {
			cls: "claude-agent-env-remove",
			text: "Remove",
		});

		const save = async () => {
			const newKey = keyInput.value.trim();
			if (newKey !== key) {
				delete plugin.settings.envVars[key];
			}
			if (newKey) {
				plugin.settings.envVars[newKey] = valueInput.value;
			}
			await plugin.saveSettings();
		};

		keyInput.addEventListener("change", () => void save());
		valueInput.addEventListener("change", () => void save());

		removeBtn.addEventListener("click", async () => {
			delete plugin.settings.envVars[key];
			await plugin.saveSettings();
			row.remove();
		});
	}
}
