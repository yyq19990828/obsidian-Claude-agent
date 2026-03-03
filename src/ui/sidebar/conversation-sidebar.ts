import { setIcon } from "obsidian";
import type { EventBus } from "../../state/event-bus";
import type { ConversationStore } from "../../state/conversation-store";
import type { ConversationTab, TabStatus } from "../../types";

const STATUS_COLORS: Record<TabStatus, string> = {
	idle: "var(--text-faint)",
	streaming: "#e9a23b",
	error: "var(--color-red)",
};

const STATUS_LABELS: Record<TabStatus, string> = {
	idle: "",
	streaming: "Responding...",
	error: "Error",
};

export interface SidebarConfig {
	onSelectConversation: (tabId: string) => void;
	onDeleteConversation: (tabId: string) => void;
	onNewConversation: () => void;
}

export class ConversationSidebar {
	private containerEl: HTMLElement;
	private listEl: HTMLElement;
	private searchInput: HTMLInputElement;
	private filterText = "";

	constructor(
		parentEl: HTMLElement,
		private readonly config: SidebarConfig,
		private readonly eventBus: EventBus,
		private readonly store: ConversationStore
	) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-sidebar" });

		/* Sidebar header */
		const header = this.containerEl.createDiv({ cls: "claude-agent-sidebar-header" });
		header.createSpan({ text: "Conversations", cls: "claude-agent-sidebar-title" });

		const newBtn = header.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "New conversation" },
		});
		setIcon(newBtn, "plus");
		newBtn.addEventListener("click", () => this.config.onNewConversation());

		/* Search */
		this.searchInput = this.containerEl.createEl("input", {
			cls: "claude-agent-sidebar-search",
			attr: { type: "text", placeholder: "Search conversations..." },
		});
		this.searchInput.addEventListener("input", () => {
			this.filterText = this.searchInput.value.toLowerCase();
			this.render();
		});

		/* List */
		this.listEl = this.containerEl.createDiv({ cls: "claude-agent-sidebar-list" });

		/* Listen for changes */
		this.eventBus.on("tab:created", () => this.render());
		this.eventBus.on("tab:closed", () => this.render());
		this.eventBus.on("tab:title-changed", () => this.render());
		this.eventBus.on("tab:status-changed", ({ tabId, status }) => {
			this.updateItemStatus(tabId, status);
		});
		this.eventBus.on("sidebar:toggle", (visible) => {
			this.containerEl.classList.toggle("is-visible", visible);
		});
	}

	render(): void {
		this.listEl.empty();
		const tabs = this.store.getAllTabs();
		const filtered = this.filterText
			? tabs.filter((t) => t.title.toLowerCase().includes(this.filterText))
			: tabs;

		if (filtered.length === 0) {
			this.listEl.createDiv({ cls: "claude-agent-sidebar-empty", text: "No conversations" });
			return;
		}

		for (const tab of filtered) {
			this.renderItem(tab);
		}
	}

	private renderItem(tab: ConversationTab): void {
		const item = this.listEl.createDiv({ cls: "claude-agent-sidebar-item" });
		item.setAttribute("data-tab-id", tab.id);

		const info = item.createDiv({ cls: "claude-agent-sidebar-item-info" });

		/* Title row with status dot */
		const titleRow = info.createDiv({ cls: "claude-agent-sidebar-item-title-row" });
		const statusDot = titleRow.createSpan({ cls: "claude-agent-sidebar-status-dot" });
		statusDot.style.background = STATUS_COLORS[tab.status];
		if (tab.status === "streaming") statusDot.classList.add("is-streaming");
		titleRow.createSpan({ cls: "claude-agent-sidebar-item-title", text: tab.title });

		/* Status label + time */
		const meta = info.createDiv({ cls: "claude-agent-sidebar-item-meta" });
		const statusLabel = meta.createSpan({ cls: "claude-agent-sidebar-item-status" });
		if (tab.status !== "idle") {
			statusLabel.setText(STATUS_LABELS[tab.status]);
			if (tab.status === "streaming") statusLabel.classList.add("is-streaming");
			if (tab.status === "error") statusLabel.classList.add("is-error");
		}

		const date = new Date(tab.updatedAt);
		const timeStr = this.formatRelativeTime(date);
		meta.createSpan({ cls: "claude-agent-sidebar-item-time", text: timeStr });

		const deleteBtn = item.createEl("button", {
			cls: "clickable-icon claude-agent-sidebar-item-delete",
			attr: { "aria-label": "Delete conversation" },
		});
		setIcon(deleteBtn, "trash-2");
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.config.onDeleteConversation(tab.id);
		});

		item.addEventListener("click", () => {
			this.config.onSelectConversation(tab.id);
		});
	}

	/** Update status dot and label without full re-render. */
	private updateItemStatus(tabId: string, status: TabStatus): void {
		const item = this.listEl.querySelector(`[data-tab-id="${tabId}"]`);
		if (!item) return;

		const dot = item.querySelector<HTMLElement>(".claude-agent-sidebar-status-dot");
		if (dot) {
			dot.style.background = STATUS_COLORS[status];
			dot.classList.toggle("is-streaming", status === "streaming");
		}

		const label = item.querySelector<HTMLElement>(".claude-agent-sidebar-item-status");
		if (label) {
			label.setText(STATUS_LABELS[status]);
			label.classList.toggle("is-streaming", status === "streaming");
			label.classList.toggle("is-error", status === "error");
		}
	}

	private formatRelativeTime(date: Date): string {
		const now = Date.now();
		const diffMs = now - date.getTime();
		const diffMin = Math.floor(diffMs / 60_000);
		if (diffMin < 1) return "just now";
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		const diffDay = Math.floor(diffHr / 24);
		if (diffDay < 7) return `${diffDay}d ago`;
		return date.toLocaleDateString();
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
