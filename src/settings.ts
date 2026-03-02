import { App, PluginSettingTab, Setting } from "obsidian";
import type ClaudeAgentPlugin from "./main";
import type { ClaudeAgentSettings, SdkToolToggles, ClaudeSettingSources } from "./types";
import { requestSuperModeConfirmation } from "./ui/confirmation-modal";

export const DEFAULT_SDK_TOOL_TOGGLES: SdkToolToggles = {
	Read: false,
	Write: false,
	Edit: false,
	Bash: false,
	Glob: false,
	Grep: false,
	Skill: false,
	WebFetch: false,
	WebSearch: false,
	NotebookEdit: false,
};

export const DEFAULT_CLAUDE_SETTING_SOURCES: ClaudeSettingSources = {
	projectSettings: false,
	projectMemory: false,
	userSettings: false,
	userMemory: false,
};

export const DEFAULT_SETTINGS: ClaudeAgentSettings = {
	apiKey: "",
	authMethod: "api_key",
	maxContextSize: 50_000,
	confirmFileOperations: true,
	model: "claude-sonnet-4-6",
	permissionMode: "safe",
	sdkToolToggles: { ...DEFAULT_SDK_TOOL_TOGGLES },
	claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES },
};

export class ClaudeAgentSettingTab extends PluginSettingTab {
	plugin: ClaudeAgentPlugin;
	onModeChange?: () => void;

	constructor(app: App, plugin: ClaudeAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Tab Bar ──
		const tabBar = containerEl.createDiv({ cls: "claude-agent-settings-tabs" });
		const generalBtn = tabBar.createEl("button", { text: "General", cls: "claude-agent-tab-button is-active" });
		const toolsBtn = tabBar.createEl("button", { text: "Tools", cls: "claude-agent-tab-button" });

		const generalTab = containerEl.createDiv({ cls: "claude-agent-tab-content is-active" });
		const toolsTab = containerEl.createDiv({ cls: "claude-agent-tab-content" });

		const switchTab = (activeBtn: HTMLElement, activeTab: HTMLElement) => {
			[generalBtn, toolsBtn].forEach((b) => b.removeClass("is-active"));
			[generalTab, toolsTab].forEach((t) => t.removeClass("is-active"));
			activeBtn.addClass("is-active");
			activeTab.addClass("is-active");
		};

		generalBtn.addEventListener("click", () => switchTab(generalBtn, generalTab));
		toolsBtn.addEventListener("click", () => switchTab(toolsBtn, toolsTab));

		// ── General Tab ──
		this.buildGeneralTab(generalTab);

		// ── Tools Tab ──
		this.buildToolsTab(toolsTab);
	}

	private buildGeneralTab(container: HTMLElement): void {
		new Setting(container)
			.setName("Authentication method")
			.setDesc("Choose how to authenticate.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("api_key", "API key")
					.addOption("claude_code", "Claude code")
					.setValue(this.plugin.settings.authMethod)
					.onChange(async (value) => {
						this.plugin.settings.authMethod = value as ClaudeAgentSettings["authMethod"];
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(container)
			.setName("API key")
			.setDesc("Used when authentication method is set to API key.")
			.addText((text) => {
				text
					.setPlaceholder("Enter key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
				text.inputEl.disabled = this.plugin.settings.authMethod !== "api_key";
			});

		new Setting(container)
			.setName("Max context size")
			.setDesc("Maximum active-note characters attached to each message.")
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.maxContextSize))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						this.plugin.settings.maxContextSize = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SETTINGS.maxContextSize;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName("Confirm file operations")
			.setDesc("Require approval before write or modify tool calls run.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.confirmFileOperations).onChange(async (value) => {
					this.plugin.settings.confirmFileOperations = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(container)
			.setName("Model")
			.setDesc("Claude model used for chat responses.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("claude-sonnet-4-6", "Claude sonnet 4.6")
					.addOption("claude-opus-4-1", "Claude opus 4.1")
					.addOption("claude-3-7-sonnet-latest", "Claude 3.7 sonnet")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private buildToolsTab(container: HTMLElement): void {
		const isSafe = this.plugin.settings.permissionMode === "safe";

		// ── Safe Mode Toggle ──
		const safeSetting = new Setting(container)
			.setName("Safe mode")
			.setDesc("When enabled, only vault-scoped MCP tools are available. Disable to access SDK built-in tools and .claude/ configuration.")
			.addToggle((toggle) => {
				toggle.setValue(isSafe).onChange(async (value) => {
					if (!value) {
						// Switching to super mode — show confirmation
						const confirmed = await requestSuperModeConfirmation(this.app);
						if (!confirmed) {
							toggle.setValue(true);
							return;
						}
						this.plugin.settings.permissionMode = "super";
					} else {
						this.plugin.settings.permissionMode = "safe";
					}
					await this.plugin.saveSettings();
					this.onModeChange?.();
					this.display();
				});
			});
		safeSetting.settingEl.addClass("claude-agent-safe-toggle");

		// ── SDK Built-in Tools (collapsible) ──
		this.buildCollapsibleSection(container, "SDK built-in tools", isSafe, (content) => {
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
		});

		// ── .claude Project Settings (collapsible) ──
		this.buildCollapsibleSection(container, ".claude Project settings", isSafe, (content) => {
			new Setting(content)
				.setName("Settings")
				.setDesc("Load .claude/settings.json and .claude/settings.local.json")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.claudeSettingSources.projectSettings).onChange(async (value) => {
						this.plugin.settings.claudeSettingSources.projectSettings = value;
						await this.plugin.saveSettings();
					});
				});
			new Setting(content)
				.setName("Memory files")
				.setDesc("Allow .claude/memory/ for persistent project memory")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.claudeSettingSources.projectMemory).onChange(async (value) => {
						this.plugin.settings.claudeSettingSources.projectMemory = value;
						await this.plugin.saveSettings();
					});
				});
		});

		// ── .claude User Settings (collapsible) ──
		this.buildCollapsibleSection(container, ".claude User settings", isSafe, (content) => {
			new Setting(content)
				.setName("Settings")
				.setDesc("Load ~/.claude/settings.json")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.claudeSettingSources.userSettings).onChange(async (value) => {
						this.plugin.settings.claudeSettingSources.userSettings = value;
						await this.plugin.saveSettings();
					});
				});
			new Setting(content)
				.setName("Memory files")
				.setDesc("Allow ~/.claude/memory/ for persistent user memory")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.claudeSettingSources.userMemory).onChange(async (value) => {
						this.plugin.settings.claudeSettingSources.userMemory = value;
						await this.plugin.saveSettings();
					});
				});
		});
	}

	private buildCollapsibleSection(
		container: HTMLElement,
		title: string,
		disabled: boolean,
		buildContent: (content: HTMLElement) => void,
	): HTMLElement {
		const wrapper = container.createDiv({ cls: `claude-agent-collapsible${disabled ? " is-disabled" : ""}` });

		const header = wrapper.createDiv({ cls: "claude-agent-collapsible-header" });
		header.createSpan({ cls: "claude-agent-collapsible-title", text: title });
		const chevron = header.createSpan({ cls: "claude-agent-collapsible-chevron", text: "▶" });

		const content = wrapper.createDiv({ cls: "claude-agent-collapsible-content" });
		buildContent(content);

		header.addEventListener("click", () => {
			if (disabled) return;
			wrapper.toggleClass("is-open", !wrapper.hasClass("is-open"));
		});

		return wrapper;
	}
}
