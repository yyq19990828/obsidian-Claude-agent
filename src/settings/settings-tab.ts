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
import { SectionMemoryConfig } from "./section-memory-config";
import { SectionSubagents } from "./section-subagents";
import { SectionHooks } from "./section-hooks";
import { SectionPlugins } from "./section-plugins";
import { SectionVaultTools } from "./section-vault-tools";
import { SectionBuiltinTools } from "./section-builtin-tools";

/* ── Main tab definitions ── */

interface MainTabDef {
	id: string;
	label: string;
	superOnly: boolean;
}

const MAIN_TABS: MainTabDef[] = [
	{ id: "general", label: "General", superOnly: false },
	{ id: "sdk-tools", label: "SDK Tools", superOnly: true },
];

/* ── Sub-tab definitions for SDK Tools ── */

interface SubTabDef {
	id: string;
	label: string;
}

const SDK_SUB_TABS: SubTabDef[] = [
	{ id: "built-in-tools", label: "Built-in Tools" },
	{ id: "memory-config", label: "Memory & Config" },
	{ id: "skills", label: "Skills" },
	{ id: "subagents", label: "Subagents" },
	{ id: "hooks", label: "Hooks" },
	{ id: "mcp", label: "MCP" },
	{ id: "plugins", label: "Plugins" },
];

export class ClaudeAgentSettingTab extends PluginSettingTab {
	plugin: ClaudeAgentPlugin;
	private activeMainTab = "general";
	private activeSubTab = "built-in-tools";
	private tabBarEl: HTMLElement | null = null;
	private contentEl: HTMLElement | null = null;

	constructor(app: App, plugin: ClaudeAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("claude-agent-settings");

		const wrapper = containerEl.createDiv({ cls: "claude-agent-settings-wrapper" });
		this.tabBarEl = wrapper.createDiv({ cls: "claude-agent-settings-tab-bar" });
		this.contentEl = wrapper.createDiv({ cls: "claude-agent-settings-content" });

		this.renderTabBar();
		this.renderTabContent();
	}

	private renderTabBar(): void {
		if (!this.tabBarEl) return;
		this.tabBarEl.empty();

		const isSafeMode = this.plugin.settings.safeMode;

		for (const tab of MAIN_TABS) {
			const isDisabled = tab.superOnly && isSafeMode;
			const isActive = tab.id === this.activeMainTab;

			const btn = this.tabBarEl.createEl("button", {
				text: tab.label,
				cls: "claude-agent-settings-tab",
			});

			if (isActive) btn.addClass("is-active");
			if (isDisabled) {
				btn.addClass("is-disabled");
				btn.title = "Enable super mode to access this tab";
			} else {
				btn.addEventListener("click", () => this.switchMainTab(tab.id));
			}
		}
	}

	private renderTabContent(): void {
		if (!this.contentEl) return;
		this.contentEl.empty();

		if (this.activeMainTab === "general") {
			this.renderGeneralContent();
		} else if (this.activeMainTab === "sdk-tools") {
			this.renderSdkToolsContent();
		}
	}

	private renderGeneralContent(): void {
		if (!this.contentEl) return;
		new SectionGeneral(this.contentEl, this.plugin);
		new SectionAuth(this.contentEl, this.plugin);
		new SectionModel(this.contentEl, this.plugin);
		new SectionSafety(this.contentEl, this.plugin, () => this.onSafeModeChanged());
		new SectionEnvironment(this.contentEl, this.plugin);
		new SectionAdvanced(this.contentEl, this.plugin);
		new SectionVaultTools(this.contentEl, this.plugin);
	}

	private renderSdkToolsContent(): void {
		if (!this.contentEl) return;

		/* Sub-tab bar */
		const subTabBar = this.contentEl.createDiv({ cls: "claude-agent-settings-sub-tab-bar" });
		this.renderSubTabBar(subTabBar);

		/* Sub-tab content */
		const subContent = this.contentEl.createDiv({ cls: "claude-agent-settings-content" });
		this.renderSubTabContent(subContent);
	}

	private renderSubTabBar(container: HTMLElement): void {
		container.empty();

		for (const sub of SDK_SUB_TABS) {
			const isActive = sub.id === this.activeSubTab;
			const btn = container.createEl("button", {
				text: sub.label,
				cls: "claude-agent-settings-sub-tab",
			});
			if (isActive) btn.addClass("is-active");
			btn.addEventListener("click", () => {
				this.activeSubTab = sub.id;
				this.renderTabContent();
			});
		}
	}

	private renderSubTabContent(container: HTMLElement): void {
		container.empty();

		switch (this.activeSubTab) {
			case "built-in-tools":
				new SectionBuiltinTools(container, this.plugin);
				break;
			case "memory-config":
				new SectionMemoryConfig(container, this.plugin);
				break;
			case "skills":
				new SectionCommands(container, this.plugin);
				break;
			case "subagents":
				new SectionSubagents(container, this.plugin);
				break;
			case "hooks":
				new SectionHooks(container, this.plugin);
				break;
			case "mcp":
				new SectionMcp(container, this.plugin);
				break;
			case "plugins":
				new SectionPlugins(container, this.plugin);
				break;
		}
	}

	private switchMainTab(tabId: string): void {
		this.activeMainTab = tabId;
		this.renderTabBar();
		this.renderTabContent();
	}

	private onSafeModeChanged(): void {
		const isSafeMode = this.plugin.settings.safeMode;
		if (isSafeMode && this.activeMainTab === "sdk-tools") {
			this.activeMainTab = "general";
		}
		this.renderTabBar();
		this.renderTabContent();
	}
}
