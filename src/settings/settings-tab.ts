import { App, PluginSettingTab } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import { SectionGeneral } from "./section-general";
import { SectionAuth } from "./section-auth";
import { SectionModel } from "./section-model";
import { SectionSafety } from "./section-safety";
import { SectionMcp } from "./section-mcp";
import { SectionCommands } from "./section-commands";
import { SectionEnvironment } from "./section-environment";
import { SectionAdvanced } from "./section-advanced";

export class ClaudeAgentSettingTab extends PluginSettingTab {
	plugin: ClaudeAgentPlugin;

	constructor(app: App, plugin: ClaudeAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("claude-agent-settings");

		new SectionGeneral(containerEl, this.plugin);
		new SectionAuth(containerEl, this.plugin);
		new SectionModel(containerEl, this.plugin);
		new SectionSafety(containerEl, this.plugin);
		new SectionMcp(containerEl, this.plugin);
		new SectionCommands(containerEl, this.plugin);
		new SectionEnvironment(containerEl, this.plugin);
		new SectionAdvanced(containerEl, this.plugin);
	}
}
