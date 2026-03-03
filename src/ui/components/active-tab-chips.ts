import { App, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type { EventBus } from "../../state/event-bus";
import type { FileContextChip } from "../../types";

/**
 * Shows currently open workspace tabs as toggleable context chips.
 * - "+" icon + italic text = available to attach
 * - "×" icon + normal text = attached (click to detach)
 */
export class ActiveTabChips {
	private containerEl: HTMLElement;
	private attachedPaths = new Set<string>();

	constructor(
		parentEl: HTMLElement,
		private readonly app: App,
		private readonly eventBus: EventBus,
	) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-active-tab-chips" });
		this.render();
	}

	/** Re-scan workspace tabs and re-render chips. */
	refresh(): void {
		this.render();
	}

	/** Get the set of attached file paths. */
	getAttachedPaths(): Set<string> {
		return new Set(this.attachedPaths);
	}

	private getOpenTabs(): { path: string; basename: string }[] {
		const seen = new Set<string>();
		const tabs: { path: string; basename: string }[] = [];

		this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const file = (leaf.view as any)?.file;
			if (file instanceof TFile && file.extension === "md" && !seen.has(file.path)) {
				seen.add(file.path);
				tabs.push({ path: file.path, basename: file.basename });
			}
		});

		return tabs;
	}

	private toggleAttach(path: string, basename: string): void {
		if (this.attachedPaths.has(path)) {
			this.attachedPaths.delete(path);
		} else {
			this.attachedPaths.add(path);
		}

		this.syncChipsToEventBus();
		this.render();
	}

	private syncChipsToEventBus(): void {
		const chips: FileContextChip[] = [];
		for (const path of this.attachedPaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				chips.push({ path: file.path, basename: file.basename });
			}
		}
		this.eventBus.emit("context:chips-changed", chips);
	}

	private render(): void {
		this.containerEl.empty();

		const openTabs = this.getOpenTabs();
		if (openTabs.length === 0) {
			this.containerEl.style.display = "none";
			return;
		}
		this.containerEl.style.display = "";

		for (const tab of openTabs) {
			const isAttached = this.attachedPaths.has(tab.path);

			const chipEl = this.containerEl.createDiv({
				cls: `claude-agent-tab-chip ${isAttached ? "is-attached" : "is-available"}`,
			});

			const iconSpan = chipEl.createSpan({ cls: "claude-agent-tab-chip-icon" });
			setIcon(iconSpan, isAttached ? "x" : "plus");

			const nameSpan = chipEl.createSpan({
				cls: "claude-agent-tab-chip-name",
				text: tab.basename,
			});

			if (!isAttached) {
				nameSpan.addClass("is-italic");
			}

			chipEl.addEventListener("click", () => this.toggleAttach(tab.path, tab.basename));
		}
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
