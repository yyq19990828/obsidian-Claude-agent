import { setIcon } from "obsidian";
import type { ConversationTab, TabStatus } from "../../types";
import type { EventBus } from "../../state/event-bus";

export interface TabBarConfig {
	onTabSelect: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
	onNewTab: () => void;
}

const STATUS_COLORS: Record<TabStatus, string> = {
	idle: "var(--text-muted)",
	streaming: "#e9a23b",
	error: "var(--color-red)",
};

export class TabBar {
	private containerEl: HTMLElement;
	private tabListEl: HTMLElement;
	private activeTabId: string | null = null;

	constructor(
		parentEl: HTMLElement,
		private readonly config: TabBarConfig,
		private readonly eventBus: EventBus
	) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-tab-bar" });
		this.tabListEl = this.containerEl.createDiv({ cls: "claude-agent-tab-list" });

		const addBtn = this.containerEl.createEl("button", {
			cls: "clickable-icon claude-agent-tab-add",
			attr: { "aria-label": "New tab" },
		});
		setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => this.config.onNewTab());

		this.eventBus.on("tab:status-changed", ({ tabId, status }) => {
			this.updateTabStatus(tabId, status);
		});
		this.eventBus.on("tab:title-changed", ({ tabId, title }) => {
			this.updateTabTitle(tabId, title);
		});
	}

	render(tabs: ConversationTab[], activeTabId: string | null): void {
		this.activeTabId = activeTabId;
		this.tabListEl.empty();

		if (tabs.length <= 1) {
			this.containerEl.classList.add("claude-agent-tab-bar-hidden");
			return;
		}
		this.containerEl.classList.remove("claude-agent-tab-bar-hidden");

		for (const tab of tabs) {
			this.renderTab(tab);
		}
	}

	private renderTab(tab: ConversationTab): void {
		const tabEl = this.tabListEl.createDiv({
			cls: `claude-agent-tab ${tab.id === this.activeTabId ? "is-active" : ""}`,
			attr: { "data-tab-id": tab.id },
		});

		const statusDot = tabEl.createSpan({ cls: "claude-agent-tab-status" });
		statusDot.style.background = STATUS_COLORS[tab.status];

		tabEl.createSpan({ cls: "claude-agent-tab-title", text: this.truncateTitle(tab.title) });

		const closeBtn = tabEl.createEl("button", {
			cls: "clickable-icon claude-agent-tab-close",
			attr: { "aria-label": "Close tab" },
		});
		setIcon(closeBtn, "x");
		closeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.config.onTabClose(tab.id);
		});

		tabEl.addEventListener("click", () => {
			this.config.onTabSelect(tab.id);
		});
	}

	private updateTabStatus(tabId: string, status: TabStatus): void {
		const tabEl = this.tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
		if (!tabEl) return;
		const dot = tabEl.querySelector(".claude-agent-tab-status") as HTMLElement | null;
		if (dot) {
			dot.style.background = STATUS_COLORS[status];
		}
	}

	private updateTabTitle(tabId: string, title: string): void {
		const tabEl = this.tabListEl.querySelector(`[data-tab-id="${tabId}"]`);
		if (!tabEl) return;
		const titleEl = tabEl.querySelector(".claude-agent-tab-title");
		if (titleEl) {
			titleEl.textContent = this.truncateTitle(title);
		}
	}

	private truncateTitle(title: string, max = 24): string {
		return title.length > max ? title.slice(0, max - 1) + "\u2026" : title;
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
