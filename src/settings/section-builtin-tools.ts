import type ClaudeAgentPlugin from "../main";
import type { SdkToolToggles } from "../types";
import { renderToolPermRow } from "./tool-permission-row";

const SDK_TOOLS: { key: keyof SdkToolToggles; name: string; desc: string }[] = [
	{ key: "Read", name: "Read", desc: "Read file contents" },
	{ key: "Write", name: "Write", desc: "Create or overwrite files" },
	{ key: "Edit", name: "Edit", desc: "Edit file contents" },
	{ key: "Bash", name: "Bash", desc: "Execute shell commands" },
	{ key: "Glob", name: "Glob", desc: "Find files by pattern" },
	{ key: "Grep", name: "Grep", desc: "Search file contents" },
	{ key: "Skill", name: "Skill", desc: "Execute skills" },
	{ key: "WebFetch", name: "WebFetch", desc: "Fetch web content" },
	{ key: "WebSearch", name: "WebSearch", desc: "Search the web" },
	{ key: "NotebookEdit", name: "NotebookEdit", desc: "Edit Jupyter notebooks" },
];

export class SectionBuiltinTools {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Built-in tools" });

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Configure permissions for SDK built-in tools.",
		});

		const list = containerEl.createDiv({ cls: "claude-agent-tool-perm-list" });

		for (const tool of SDK_TOOLS) {
			renderToolPermRow(
				list,
				tool.name,
				tool.desc,
				plugin.settings.sdkToolToggles[tool.key],
				async (value) => {
					plugin.settings.sdkToolToggles[tool.key] = value;
					await plugin.saveSettings();
				},
			);
		}
	}
}
