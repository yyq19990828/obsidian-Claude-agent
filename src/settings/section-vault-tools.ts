import type ClaudeAgentPlugin from "../main";
import type { VaultToolPermissions } from "../types";
import { renderToolPermRow } from "./tool-permission-row";

const VAULT_TOOLS: { key: keyof VaultToolPermissions; name: string; desc: string }[] = [
	{ key: "read_note", name: "read_note", desc: "Read content from a vault note" },
	{ key: "write_note", name: "write_note", desc: "Create or overwrite a vault note" },
	{ key: "modify_note", name: "modify_note", desc: "Replace content inside an existing note" },
];

export class SectionVaultTools {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Vault tools" });

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Configure permissions for vault operation tools.",
		});

		const list = containerEl.createDiv({ cls: "claude-agent-tool-perm-list" });

		for (const tool of VAULT_TOOLS) {
			renderToolPermRow(
				list,
				tool.name,
				tool.desc,
				plugin.settings.vaultToolPermissions[tool.key],
				async (value) => {
					plugin.settings.vaultToolPermissions[tool.key] = value;
					await plugin.saveSettings();
				},
			);
		}
	}
}
