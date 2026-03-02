import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { McpServerConfig } from "../types";

export class SectionMcp {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "MCP servers" });

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Configure external MCP servers for additional tool capabilities.",
		});

		const listEl = containerEl.createDiv({ cls: "claude-agent-mcp-list" });
		this.renderList(listEl, plugin);

		new Setting(containerEl).addButton((btn) => {
			btn.setButtonText("Add MCP server").onClick(() => {
				const newServer: McpServerConfig = {
					id: crypto.randomUUID(),
					name: "",
					command: "",
					args: [],
					env: {},
					enabled: true,
				};
				plugin.settings.mcpServers.push(newServer);
				void plugin.saveSettings();
				this.renderList(listEl, plugin);
			});
		});
	}

	private renderList(listEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		listEl.empty();

		if (plugin.settings.mcpServers.length === 0) {
			listEl.createDiv({ cls: "claude-agent-mcp-empty", text: "No MCP servers configured." });
			return;
		}

		for (const server of plugin.settings.mcpServers) {
			this.renderServer(listEl, server, plugin);
		}
	}

	private renderServer(listEl: HTMLElement, server: McpServerConfig, plugin: ClaudeAgentPlugin): void {
		const card = listEl.createDiv({ cls: "claude-agent-mcp-card" });

		new Setting(card)
			.setName("Server name")
			.addText((text) => {
				text
					.setPlaceholder("my-server")
					.setValue(server.name)
					.onChange(async (value) => {
						server.name = value.trim();
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Command")
			.addText((text) => {
				text
					.setPlaceholder("npx -y @my/mcp-server")
					.setValue(server.command)
					.onChange(async (value) => {
						server.command = value.trim();
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Arguments")
			.setDesc("Space-separated arguments.")
			.addText((text) => {
				text
					.setPlaceholder("--port 3000")
					.setValue(server.args.join(" "))
					.onChange(async (value) => {
						server.args = value.split(" ").filter(Boolean);
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Enabled")
			.addToggle((toggle) => {
				toggle.setValue(server.enabled).onChange(async (value) => {
					server.enabled = value;
					await plugin.saveSettings();
				});
			});

		new Setting(card).addButton((btn) => {
			btn
				.setButtonText("Remove")
				.setWarning()
				.onClick(async () => {
					plugin.settings.mcpServers = plugin.settings.mcpServers.filter((s) => s.id !== server.id);
					await plugin.saveSettings();
					card.remove();
				});
		});
	}
}
