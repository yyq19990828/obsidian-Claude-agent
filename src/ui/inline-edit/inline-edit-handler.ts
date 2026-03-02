import { Editor, MarkdownView, Notice, type MarkdownFileInfo } from "obsidian";
import type { EventBus } from "../../state/event-bus";

export interface InlineEditConfig {
	onEditRequest: (selectedText: string, filePath: string, instruction: string) => void;
}

export class InlineEditHandler {
	constructor(
		private readonly config: InlineEditConfig,
		private readonly eventBus: EventBus
	) {}

	registerEditorMenu(plugin: { registerEvent: (evt: ReturnType<typeof import("obsidian").Workspace.prototype.on>) => void; app: import("obsidian").App }): void {
		plugin.registerEvent(
			plugin.app.workspace.on("editor-menu", (menu, editor, view) => {
				const selection = editor.getSelection();
				if (!selection) return;
				if (!(view instanceof MarkdownView)) return;

				const mdView = view;
				menu.addItem((item) => {
					item
						.setTitle("Ask Claude to edit")
						.setIcon("pencil")
						.onClick(() => {
							this.showInlineEditPrompt(editor, mdView);
						});
				});
			})
		);
	}

	private showInlineEditPrompt(editor: Editor, view: MarkdownView): void {
		const selection = editor.getSelection();
		if (!selection) {
			new Notice("No text selected.");
			return;
		}

		const filePath = view.file?.path ?? "";

		const modal = document.createElement("div");
		modal.className = "claude-agent-inline-edit-modal";

		const backdrop = document.createElement("div");
		backdrop.className = "claude-agent-inline-edit-backdrop";

		const card = document.createElement("div");
		card.className = "claude-agent-inline-edit-card";

		card.createEl("h3", { text: "Edit with Claude" });

		const preview = card.createEl("pre", { cls: "claude-agent-inline-edit-preview" });
		preview.setText(selection.slice(0, 200) + (selection.length > 200 ? "..." : ""));

		const input = card.createEl("textarea", {
			cls: "claude-agent-inline-edit-input",
			attr: { placeholder: "Describe how to edit this text...", rows: "3" },
		});

		const actions = card.createDiv({ cls: "claude-agent-inline-edit-actions" });
		const cancelBtn = actions.createEl("button", { text: "Cancel" });
		const submitBtn = actions.createEl("button", { text: "Edit", cls: "mod-cta" });

		const cleanup = () => {
			modal.remove();
		};

		cancelBtn.addEventListener("click", cleanup);
		backdrop.addEventListener("click", cleanup);

		submitBtn.addEventListener("click", () => {
			const instruction = input.value.trim();
			if (!instruction) {
				new Notice("Please describe the edit.");
				return;
			}
			cleanup();
			this.config.onEditRequest(selection, filePath, instruction);
		});

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				submitBtn.click();
			}
			if (e.key === "Escape") {
				cleanup();
			}
		});

		modal.appendChild(backdrop);
		modal.appendChild(card);
		document.body.appendChild(modal);
		input.focus();
	}
}
