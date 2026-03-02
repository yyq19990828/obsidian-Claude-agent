import { setIcon } from "obsidian";
import type { FileContextChip } from "../../types";
import type { EventBus } from "../../state/event-bus";

export class FileContextChips {
	private containerEl: HTMLElement;
	private chips: FileContextChip[] = [];

	constructor(parentEl: HTMLElement, private readonly eventBus: EventBus) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-file-chips" });
		this.containerEl.style.display = "none";

		this.eventBus.on("context:chips-changed", (chips) => {
			this.chips = chips;
			this.render();
		});
	}

	addChip(chip: FileContextChip): void {
		if (this.chips.some((c) => c.path === chip.path)) return;
		this.chips.push(chip);
		this.eventBus.emit("context:chips-changed", [...this.chips]);
	}

	removeChip(path: string): void {
		this.chips = this.chips.filter((c) => c.path !== path);
		this.eventBus.emit("context:chips-changed", [...this.chips]);
	}

	getChips(): FileContextChip[] {
		return [...this.chips];
	}

	private render(): void {
		this.containerEl.empty();
		if (this.chips.length === 0) {
			this.containerEl.style.display = "none";
			return;
		}
		this.containerEl.style.display = "";

		for (const chip of this.chips) {
			const chipEl = this.containerEl.createDiv({ cls: "claude-agent-file-chip" });
			const iconSpan = chipEl.createSpan({ cls: "claude-agent-file-chip-icon" });
			setIcon(iconSpan, "file-text");
			chipEl.createSpan({ cls: "claude-agent-file-chip-name", text: chip.basename });

			const removeBtn = chipEl.createEl("button", {
				cls: "claude-agent-file-chip-remove",
				attr: { "aria-label": "Remove file" },
			});
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => this.removeChip(chip.path));
		}
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
