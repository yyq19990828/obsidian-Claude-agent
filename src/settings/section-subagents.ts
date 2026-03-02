import { Setting } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import process from "process";
import type ClaudeAgentPlugin from "../main";
import type { SubagentConfig } from "../types";
import { loadFileAgentsByLayer, type FileAgentDef, type FileAgentsByLayer } from "../agent/agent-loader";

/** Layer display order: highest priority first */
const LAYER_ORDER: { key: keyof FileAgentsByLayer; label: string; pathHint: string }[] = [
	{ key: "custom", label: "Custom", pathHint: "<plugin-dir>/<config-subdir>/agents/" },
	{ key: "project", label: "Project", pathHint: "<vault>/.claude/agents/" },
	{ key: "user", label: "User", pathHint: "~/.claude/agents/" },
];

export class SectionSubagents {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		containerEl.createEl("h2", { text: "Subagents" });

		/* ── Built-in (UI-defined) subagents ── */
		containerEl.createEl("h3", { text: "Built-in subagents" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Define custom subagents that the Claude agent can delegate tasks to.",
		});

		const listEl = containerEl.createDiv({ cls: "claude-agent-subagent-list" });
		this.renderBuiltinList(listEl, plugin);

		new Setting(containerEl).addButton((btn) => {
			btn.setButtonText("Add subagent").onClick(() => {
				const newAgent: SubagentConfig = {
					id: crypto.randomUUID(),
					name: "",
					description: "",
					prompt: "",
					model: "inherit",
					tools: [],
					maxTurns: 0,
					enabled: true,
				};
				plugin.settings.subagents.push(newAgent);
				void plugin.saveSettings();
				this.renderBuiltinList(listEl, plugin);
			});
		});

		/* ── Filesystem subagents (read-only, grouped by layer) ── */
		containerEl.createEl("h3", { text: "Filesystem subagents" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Agents loaded from .md files. Edit these files directly to modify. Higher layers override lower layers for same-name agents.",
		});

		const fsListEl = containerEl.createDiv({ cls: "claude-agent-subagent-fs-list" });
		this.renderFilesystemLayers(fsListEl, plugin);
	}

	/* ── Built-in agents ── */

	private renderBuiltinList(listEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		listEl.empty();

		if (plugin.settings.subagents.length === 0) {
			listEl.createDiv({
				cls: "claude-agent-subagent-empty",
				text: "No built-in subagents configured.",
			});
			return;
		}

		for (const agent of plugin.settings.subagents) {
			this.renderBuiltinCard(listEl, agent, plugin);
		}
	}

	private renderBuiltinCard(listEl: HTMLElement, agent: SubagentConfig, plugin: ClaudeAgentPlugin): void {
		const card = listEl.createDiv({ cls: "claude-agent-mcp-card" });

		new Setting(card)
			.setName("Name")
			.addText((text) => {
				text
					.setPlaceholder("my-agent")
					.setValue(agent.name)
					.onChange(async (value) => {
						agent.name = value.trim();
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Description")
			.setDesc("When to use this agent.")
			.addText((text) => {
				text
					.setPlaceholder("Handles code review tasks")
					.setValue(agent.description)
					.onChange(async (value) => {
						agent.description = value;
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Prompt")
			.setDesc("System prompt for this subagent.")
			.addTextArea((ta) => {
				ta
					.setPlaceholder("You are a specialist in...")
					.setValue(agent.prompt)
					.onChange(async (value) => {
						agent.prompt = value;
						await plugin.saveSettings();
					});
				ta.inputEl.rows = 4;
				ta.inputEl.style.width = "100%";
			});

		new Setting(card)
			.setName("Model")
			.addDropdown((dd) => {
				dd.addOption("inherit", "Inherit from parent");
				dd.addOption("sonnet", "Sonnet");
				dd.addOption("opus", "Opus");
				dd.addOption("haiku", "Haiku");
				dd.setValue(agent.model);
				dd.onChange(async (value) => {
					agent.model = value as SubagentConfig["model"];
					await plugin.saveSettings();
				});
			});

		new Setting(card)
			.setName("Tools")
			.setDesc("Comma-separated tool names. Empty = inherit parent tools.")
			.addText((text) => {
				text
					.setPlaceholder("Read, Grep, Bash")
					.setValue(agent.tools.join(", "))
					.onChange(async (value) => {
						agent.tools = value.split(",").map((s) => s.trim()).filter(Boolean);
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Max turns")
			.setDesc("0 = no limit.")
			.addText((text) => {
				text
					.setPlaceholder("0")
					.setValue(String(agent.maxTurns))
					.onChange(async (value) => {
						const n = parseInt(value, 10);
						agent.maxTurns = isNaN(n) || n < 0 ? 0 : n;
						await plugin.saveSettings();
					});
			});

		new Setting(card)
			.setName("Enabled")
			.addToggle((toggle) => {
				toggle.setValue(agent.enabled).onChange(async (value) => {
					agent.enabled = value;
					await plugin.saveSettings();
				});
			});

		new Setting(card).addButton((btn) => {
			btn
				.setButtonText("Remove")
				.setWarning()
				.onClick(async () => {
					plugin.settings.subagents = plugin.settings.subagents.filter((s) => s.id !== agent.id);
					await plugin.saveSettings();
					card.remove();
				});
		});
	}

	/* ── Filesystem agents (grouped by layer, collapsible) ── */

	private renderFilesystemLayers(container: HTMLElement, plugin: ClaudeAgentPlugin): void {
		const adapter = plugin.app.vault.adapter;
		const vaultDir = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "";
		const pluginDir = vaultDir ? `${vaultDir}/.obsidian/plugins/${plugin.manifest.id}` : "";
		const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";

		if (!vaultDir) {
			container.createDiv({
				cls: "claude-agent-subagent-empty",
				text: "Filesystem agents require desktop vault access.",
			});
			return;
		}

		const byLayer = loadFileAgentsByLayer(
			homeDir,
			vaultDir,
			pluginDir,
			plugin.settings.agentConfigSubdir,
			plugin.settings.configLayerToggles,
		);

		const hasAny = byLayer.custom.length > 0 || byLayer.project.length > 0 || byLayer.user.length > 0;
		if (!hasAny) {
			container.createDiv({
				cls: "claude-agent-subagent-empty",
				text: "No filesystem agents found. Place .md files in the agent directories to define subagents.",
			});
			return;
		}

		for (const layer of LAYER_ORDER) {
			const agents = byLayer[layer.key];
			if (agents.length === 0) continue;
			this.renderLayerGroup(container, layer.label, layer.pathHint, agents);
		}
	}

	private renderLayerGroup(container: HTMLElement, label: string, pathHint: string, agents: FileAgentDef[]): void {
		const details = container.createEl("details", { cls: "claude-agent-fs-layer-group" });
		const summary = details.createEl("summary", { cls: "claude-agent-fs-layer-summary" });
		summary.createEl("strong", { text: `${label} layer` });
		summary.createEl("span", {
			cls: "claude-agent-fs-layer-count",
			text: ` (${agents.length} agent${agents.length > 1 ? "s" : ""})`,
		});
		summary.createEl("span", {
			cls: "claude-agent-fs-layer-path setting-item-description",
			text: ` — ${pathHint}`,
		});

		const listEl = details.createDiv({ cls: "claude-agent-fs-layer-list" });
		for (const agent of agents) {
			this.renderFilesystemCard(listEl, agent);
		}
	}

	private renderFilesystemCard(container: HTMLElement, agent: FileAgentDef): void {
		const card = container.createDiv({ cls: "claude-agent-mcp-card claude-agent-readonly-card" });

		const header = card.createDiv({ cls: "claude-agent-fs-agent-header" });
		header.createEl("strong", { text: agent.name });

		if (agent.description) {
			card.createEl("p", {
				cls: "setting-item-description",
				text: agent.description,
			});
		}

		const details = card.createDiv({ cls: "claude-agent-fs-agent-details" });
		if (agent.model !== "inherit") {
			details.createEl("span", { text: `Model: ${agent.model}` });
		}
		if (agent.tools.length > 0) {
			details.createEl("span", { text: `Tools: ${agent.tools.join(", ")}` });
		}
		if (agent.maxTurns > 0) {
			details.createEl("span", { text: `Max turns: ${agent.maxTurns}` });
		}

		card.createEl("p", {
			cls: "setting-item-description claude-agent-fs-agent-path",
			text: agent.filePath,
		});
	}
}
