import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { PermissionMode, SdkToolToggles } from "../types";
import { requestSuperModeConfirmation } from "../ui/modals/super-mode-confirm-modal";

export class SectionSafety {
	private plugin: ClaudeAgentPlugin;
	private containerEl: HTMLElement;

	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.render();
	}

	private render(): void {
		const { containerEl, plugin } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Safety" });

		new Setting(containerEl)
			.setName("Permission mode")
			.setDesc("Controls how tool calls are approved.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto_approve", "Auto approve")
					.addOption("confirm", "Confirm each action")
					.addOption("plan_only", "Plan only (no execution)")
					.setValue(plugin.settings.permissionMode)
					.onChange(async (value) => {
						plugin.settings.permissionMode = value as PermissionMode;
						await plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Confirm file operations")
			.setDesc("Require approval before write or modify tool calls run.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.confirmFileOperations).onChange(async (value) => {
					plugin.settings.confirmFileOperations = value;
					await plugin.saveSettings();
				});
			});

		/* ── Safe / Super mode ── */

		containerEl.createEl("h3", { text: "SDK access mode" });

		new Setting(containerEl)
			.setName("Safe mode")
			.setDesc("When enabled, only vault-scoped MCP tools are available. Disable to access SDK built-in tools and .claude/ configuration.")
			.addToggle((toggle) => {
				toggle.setValue(plugin.settings.safeMode).onChange(async (value) => {
					if (!value) {
						const confirmed = await requestSuperModeConfirmation(plugin.app);
						if (!confirmed) {
							toggle.setValue(true);
							return;
						}
						plugin.settings.safeMode = false;
					} else {
						plugin.settings.safeMode = true;
					}
					await plugin.saveSettings();
					this.render();
				});
			});

		if (!plugin.settings.safeMode) {
			this.buildSdkToolToggles(containerEl);
			this.buildClaudeSettingSources(containerEl);
		}

		/* ── Restrictions ── */

		containerEl.createEl("h3", { text: "Restrictions" });

		new Setting(containerEl)
			.setName("Command blacklist")
			.setDesc("Comma-separated list of commands the agent should never execute.")
			.addTextArea((text) => {
				text
					.setPlaceholder("rm -rf, git push --force")
					.setValue(plugin.settings.commandBlacklist.join(", "))
					.onChange(async (value) => {
						plugin.settings.commandBlacklist = value
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean);
						await plugin.saveSettings();
					});
				text.inputEl.rows = 3;
			});

		new Setting(containerEl)
			.setName("Allowed paths")
			.setDesc("Restrict file operations to these vault paths. One per line. Leave empty to allow all.")
			.addTextArea((text) => {
				text
					.setPlaceholder("notes/\ntemplates/")
					.setValue(plugin.settings.allowedPaths.join("\n"))
					.onChange(async (value) => {
						plugin.settings.allowedPaths = value
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean);
						await plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});
	}

	private buildSdkToolToggles(container: HTMLElement): void {
		const detail = container.createEl("details", { cls: "claude-agent-collapsible" });
		detail.createEl("summary", { text: "SDK built-in tools" });
		const content = detail.createDiv();

		const toolNames: (keyof SdkToolToggles)[] = [
			"Read", "Write", "Edit", "Bash", "Glob",
			"Grep", "Skill", "WebFetch", "WebSearch", "NotebookEdit",
		];
		for (const toolName of toolNames) {
			new Setting(content)
				.setName(toolName)
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.sdkToolToggles[toolName]).onChange(async (value) => {
						this.plugin.settings.sdkToolToggles[toolName] = value;
						await this.plugin.saveSettings();
					});
				});
		}
	}

	private buildClaudeSettingSources(container: HTMLElement): void {
		const detail = container.createEl("details", { cls: "claude-agent-collapsible" });
		detail.createEl("summary", { text: ".claude configuration" });
		const content = detail.createDiv();

		new Setting(content)
			.setName("Project settings")
			.setDesc("Load .claude/settings.json and .claude/settings.local.json")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.claudeSettingSources.projectSettings).onChange(async (value) => {
					this.plugin.settings.claudeSettingSources.projectSettings = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(content)
			.setName("Project memory")
			.setDesc("Allow .claude/memory/ for persistent project memory")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.claudeSettingSources.projectMemory).onChange(async (value) => {
					this.plugin.settings.claudeSettingSources.projectMemory = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(content)
			.setName("User settings")
			.setDesc("Load ~/.claude/settings.json")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.claudeSettingSources.userSettings).onChange(async (value) => {
					this.plugin.settings.claudeSettingSources.userSettings = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(content)
			.setName("User memory")
			.setDesc("Allow ~/.claude/memory/ for persistent user memory")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.claudeSettingSources.userMemory).onChange(async (value) => {
					this.plugin.settings.claudeSettingSources.userMemory = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
