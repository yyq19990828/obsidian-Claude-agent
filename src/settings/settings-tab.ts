import { App, PluginSettingTab, Notice } from "obsidian";
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

	/**
	 * Tracks whether SDK Tools settings have been modified since last save/apply.
	 * Snapshot taken when entering SDK Tools tab; compared on navigation away.
	 */
	private sdkDirty = false;
	private sdkSettingsSnapshot = "";
	private saveBarEl: HTMLElement | null = null;

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

	/** Called by Obsidian when user closes or navigates away from settings */
	hide(): void {
		if (this.sdkDirty) {
			this.promptSaveAndApply();
		}
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
		this.saveBarEl = null;

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

		/* Take snapshot for dirty detection */
		this.sdkSettingsSnapshot = this.takeSdkSnapshot();
		this.sdkDirty = false;

		/* Sub-tab bar */
		const subTabBar = this.contentEl.createDiv({ cls: "claude-agent-settings-sub-tab-bar" });
		this.renderSubTabBar(subTabBar);

		/* Sub-tab content */
		const subContent = this.contentEl.createDiv({ cls: "claude-agent-settings-content" });
		this.renderSubTabContent(subContent);

		/* Sticky save bar (hidden until dirty) */
		this.saveBarEl = this.contentEl.createDiv({ cls: "claude-agent-save-bar" });
		this.saveBarEl.style.display = "none";

		const barInner = this.saveBarEl.createDiv({ cls: "claude-agent-save-bar-inner" });
		barInner.createEl("span", {
			cls: "claude-agent-save-bar-text",
			text: "Unsaved changes — SDK Tool changes take effect on new conversations.",
		});
		const saveBtn = barInner.createEl("button", {
			cls: "claude-agent-save-bar-btn",
			text: "Save & apply",
		});
		saveBtn.addEventListener("click", () => {
			void this.doSaveAndApply();
		});

		/* Start polling for dirty state (settings change via onChange callbacks) */
		this.startDirtyCheck();
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
				/* Re-render only the content portion, not the whole SDK tools area.
				   Keep dirty state and save bar. */
				const contentArea = container.nextElementSibling;
				if (contentArea instanceof HTMLElement) {
					contentArea.empty();
					this.renderSubTabSectionOnly(contentArea);
				}
				/* Update sub-tab active states */
				container.querySelectorAll(".claude-agent-settings-sub-tab").forEach((el) => {
					el.removeClass("is-active");
				});
				btn.addClass("is-active");
			});
		}
	}

	private renderSubTabContent(container: HTMLElement): void {
		container.empty();
		this.renderSubTabSectionOnly(container);
	}

	private renderSubTabSectionOnly(container: HTMLElement): void {
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
		/* Prompt save if leaving SDK Tools while dirty */
		if (this.activeMainTab === "sdk-tools" && tabId !== "sdk-tools" && this.sdkDirty) {
			this.promptSaveAndApply();
		}

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

	/* ── Dirty state & save bar ── */

	/**
	 * Serialise the SDK-relevant settings into a string for comparison.
	 */
	private takeSdkSnapshot(): string {
		const s = this.plugin.settings;
		return JSON.stringify({
			sdkToolToggles: s.sdkToolToggles,
			claudeSettingSources: s.claudeSettingSources,
			mcpServers: s.mcpServers,
			subagents: s.subagents,
			slashCommands: s.slashCommands,
			envVars: s.envVars,
		});
	}

	private checkDirty(): void {
		if (this.activeMainTab !== "sdk-tools") return;
		const current = this.takeSdkSnapshot();
		const wasDirty = this.sdkDirty;
		this.sdkDirty = current !== this.sdkSettingsSnapshot;

		if (this.sdkDirty !== wasDirty && this.saveBarEl) {
			this.saveBarEl.style.display = this.sdkDirty ? "flex" : "none";
		}
	}

	private dirtyCheckTimer: ReturnType<typeof setInterval> | null = null;

	private startDirtyCheck(): void {
		this.stopDirtyCheck();
		this.dirtyCheckTimer = setInterval(() => this.checkDirty(), 500);
	}

	private stopDirtyCheck(): void {
		if (this.dirtyCheckTimer !== null) {
			clearInterval(this.dirtyCheckTimer);
			this.dirtyCheckTimer = null;
		}
	}

	private async doSaveAndApply(): Promise<void> {
		this.stopDirtyCheck();
		await this.plugin.saveAndApply();
		this.sdkSettingsSnapshot = this.takeSdkSnapshot();
		this.sdkDirty = false;
		if (this.saveBarEl) {
			this.saveBarEl.style.display = "none";
		}
		this.startDirtyCheck();
	}

	private promptSaveAndApply(): void {
		this.stopDirtyCheck();
		new Notice("SDK Tools settings changed — applying and starting a new conversation.");
		void this.plugin.saveAndApply();
		this.sdkSettingsSnapshot = this.takeSdkSnapshot();
		this.sdkDirty = false;
	}
}
