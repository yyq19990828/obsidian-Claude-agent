import type { ConversationTab, TabStatus } from "../types";
import type { ConversationStore } from "./conversation-store";
import { EventBus } from "./event-bus";

export class TabManager {
	private activeTabId: string | null = null;

	constructor(
		private readonly store: ConversationStore,
		private readonly eventBus: EventBus
	) {}

	getActiveTabId(): string | null {
		return this.activeTabId;
	}

	getActiveTab(): ConversationTab | undefined {
		if (!this.activeTabId) return undefined;
		return this.store.getTab(this.activeTabId);
	}

	setActiveTab(tabId: string): void {
		if (this.activeTabId === tabId) return;
		this.activeTabId = tabId;
		this.eventBus.emit("tab:switched", tabId);
	}

	createAndActivate(title?: string): ConversationTab {
		const tab = this.store.createTab(title);
		this.setActiveTab(tab.id);
		return tab;
	}

	closeTab(tabId: string): void {
		this.store.deleteTab(tabId);

		if (this.activeTabId === tabId) {
			const remaining = this.store.getAllTabs();
			if (remaining.length > 0 && remaining[0]) {
				this.setActiveTab(remaining[0].id);
			} else {
				this.activeTabId = null;
			}
		}
	}

	setStatus(tabId: string, status: TabStatus): void {
		const tab = this.store.getTab(tabId);
		if (!tab) return;
		tab.status = status;
		this.eventBus.emit("tab:status-changed", { tabId, status });
	}

	ensureActiveTab(): ConversationTab {
		if (this.activeTabId) {
			const existing = this.store.getTab(this.activeTabId);
			if (existing) return existing;
		}

		const all = this.store.getAllTabs();
		const first = all[0];
		if (all.length > 0 && first) {
			this.setActiveTab(first.id);
			return first;
		}

		return this.createAndActivate();
	}

	restoreActiveTab(savedActiveId: string | null): void {
		if (savedActiveId && this.store.getTab(savedActiveId)) {
			this.activeTabId = savedActiveId;
		} else {
			const all = this.store.getAllTabs();
			this.activeTabId = (all.length > 0 && all[0]) ? all[0].id : null;
		}
	}
}
