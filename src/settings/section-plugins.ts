import type ClaudeAgentPlugin from "../main";

export class SectionPlugins {
	constructor(containerEl: HTMLElement, _plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Plugins" });

		containerEl.createEl("p", {
			cls: "claude-agent-settings-placeholder",
			text: "Plugin configuration is coming soon.",
		});
	}
}
