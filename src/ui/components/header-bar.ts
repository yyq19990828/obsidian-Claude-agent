import { setIcon } from "obsidian";
import type { EventBus } from "../../state/event-bus";

export interface HeaderBarConfig {
	onClear: () => void;
	onNewTab: () => void;
	onToggleSidebar: () => void;
}

export class HeaderBar {
	private containerEl: HTMLElement;

	constructor(
		parentEl: HTMLElement,
		private readonly config: HeaderBarConfig,
		private readonly eventBus: EventBus
	) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-header" });
		this.render();
	}

	private render(): void {
		const leftGroup = this.containerEl.createDiv({ cls: "claude-agent-header-left" });

		const sidebarBtn = leftGroup.createEl("button", {
			cls: "clickable-icon claude-agent-header-btn",
			attr: { "aria-label": "Toggle sidebar" },
		});
		setIcon(sidebarBtn, "panel-left");
		sidebarBtn.addEventListener("click", () => this.config.onToggleSidebar());

		leftGroup.createEl("span", { text: "Claude Agent", cls: "claude-agent-header-title" });

		const rightGroup = this.containerEl.createDiv({ cls: "claude-agent-header-right" });

		const newTabBtn = rightGroup.createEl("button", {
			cls: "clickable-icon claude-agent-header-btn",
			attr: { "aria-label": "New conversation" },
		});
		setIcon(newTabBtn, "plus");
		newTabBtn.addEventListener("click", () => this.config.onNewTab());

		const clearBtn = rightGroup.createEl("button", {
			cls: "clickable-icon claude-agent-header-btn",
			attr: { "aria-label": "Clear conversation" },
		});
		setIcon(clearBtn, "trash-2");
		clearBtn.addEventListener("click", () => this.config.onClear());
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
