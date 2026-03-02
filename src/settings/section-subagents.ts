import type ClaudeAgentPlugin from "../main";

export class SectionSubagents {
	constructor(containerEl: HTMLElement, _plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Subagents" });

		containerEl.createEl("p", {
			cls: "claude-agent-settings-placeholder",
			text: "Subagent configuration is coming soon.",
		});
	}
}
