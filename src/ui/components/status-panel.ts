import { setIcon } from "obsidian";
import type { EventBus } from "../../state/event-bus";

export class StatusPanel {
	private containerEl: HTMLElement;
	private headerEl: HTMLElement;
	private contentEl: HTMLElement;
	private toolStatusEl: HTMLElement;
	private bashOutputEl: HTMLElement;
	private collapsed = true;

	constructor(parentEl: HTMLElement, private readonly eventBus: EventBus) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-status-panel" });

		this.headerEl = this.containerEl.createDiv({ cls: "claude-agent-status-header" });
		const toggleIcon = this.headerEl.createSpan({ cls: "claude-agent-status-toggle" });
		setIcon(toggleIcon, "chevron-up");
		this.headerEl.createSpan({ cls: "claude-agent-status-title", text: "Status" });

		this.contentEl = this.containerEl.createDiv({ cls: "claude-agent-status-content" });
		this.contentEl.style.display = "none";

		/* Tool status section */
		this.contentEl.createDiv({ cls: "claude-agent-status-section-title", text: "Active tools" });
		this.toolStatusEl = this.contentEl.createDiv({ cls: "claude-agent-status-tools" });
		this.toolStatusEl.createDiv({ cls: "claude-agent-status-empty", text: "No active tools" });

		/* Bash output section */
		this.contentEl.createDiv({ cls: "claude-agent-status-section-title", text: "Output" });
		this.bashOutputEl = this.contentEl.createEl("pre", { cls: "claude-agent-status-bash" });

		this.headerEl.addEventListener("click", () => this.toggle());

		this.eventBus.on("status:tool-active", ({ toolName, status }) => {
			this.updateToolStatus(toolName, status);
		});
		this.eventBus.on("status:bash-output", (output) => {
			this.appendBashOutput(output);
		});
	}

	private toggle(): void {
		this.collapsed = !this.collapsed;
		this.contentEl.style.display = this.collapsed ? "none" : "";
		const icon = this.headerEl.querySelector(".claude-agent-status-toggle");
		if (icon) {
			icon.empty();
			setIcon(icon as HTMLElement, this.collapsed ? "chevron-up" : "chevron-down");
		}
	}

	private updateToolStatus(toolName: string, status: string): void {
		this.toolStatusEl.empty();
		const item = this.toolStatusEl.createDiv({ cls: "claude-agent-status-tool-item" });
		const dot = item.createSpan({ cls: "claude-agent-status-dot" });
		dot.classList.add(status === "running" ? "is-running" : "is-done");
		item.createSpan({ text: `${toolName}: ${status}` });
	}

	private appendBashOutput(output: string): void {
		this.bashOutputEl.textContent = (this.bashOutputEl.textContent ?? "") + output + "\n";
		this.bashOutputEl.scrollTop = this.bashOutputEl.scrollHeight;
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
