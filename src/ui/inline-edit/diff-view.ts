import { setIcon, Notice } from "obsidian";

export interface DiffViewConfig {
	onAccept: (newContent: string) => void;
	onReject: () => void;
}

export class DiffView {
	private containerEl: HTMLElement;

	constructor(
		parentEl: HTMLElement,
		original: string,
		edited: string,
		private readonly config: DiffViewConfig
	) {
		this.containerEl = parentEl.createDiv({ cls: "claude-agent-diff-view" });
		this.render(original, edited);
	}

	private render(original: string, edited: string): void {
		const header = this.containerEl.createDiv({ cls: "claude-agent-diff-header" });
		header.createSpan({ text: "Proposed edit", cls: "claude-agent-diff-title" });

		const content = this.containerEl.createDiv({ cls: "claude-agent-diff-content" });

		/* Simple side-by-side diff */
		const columns = content.createDiv({ cls: "claude-agent-diff-columns" });

		const leftCol = columns.createDiv({ cls: "claude-agent-diff-col claude-agent-diff-original" });
		leftCol.createDiv({ cls: "claude-agent-diff-col-label", text: "Original" });
		const leftPre = leftCol.createEl("pre");
		leftPre.setText(original);

		const rightCol = columns.createDiv({ cls: "claude-agent-diff-col claude-agent-diff-edited" });
		rightCol.createDiv({ cls: "claude-agent-diff-col-label", text: "Edited" });
		const rightPre = rightCol.createEl("pre");
		rightPre.setText(edited);

		/* Action buttons */
		const actions = this.containerEl.createDiv({ cls: "claude-agent-diff-actions" });

		const acceptBtn = actions.createEl("button", { cls: "mod-cta", text: "Accept" });
		const acceptIcon = acceptBtn.createSpan();
		setIcon(acceptIcon, "check");
		acceptBtn.addEventListener("click", () => {
			this.config.onAccept(edited);
			this.destroy();
			new Notice("Edit applied.");
		});

		const rejectBtn = actions.createEl("button", { text: "Reject" });
		const rejectIcon = rejectBtn.createSpan();
		setIcon(rejectIcon, "x");
		rejectBtn.addEventListener("click", () => {
			this.config.onReject();
			this.destroy();
			new Notice("Edit rejected.");
		});
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
