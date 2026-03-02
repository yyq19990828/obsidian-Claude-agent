import type ClaudeAgentPlugin from "../main";

export class SectionHooks {
	constructor(containerEl: HTMLElement, _plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Hooks" });

		containerEl.createEl("p", {
			cls: "claude-agent-settings-placeholder",
			text: "Hook configuration is coming soon.",
		});
	}
}
