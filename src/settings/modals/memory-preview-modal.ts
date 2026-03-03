import { Modal, MarkdownRenderer, Component } from "obsidian";

export class MemoryPreviewModal extends Modal {
	private component = new Component();

	constructor(
		app: import("obsidian").App,
		private readonly title: string,
		private readonly markdown: string,
		private readonly filePath: string,
	) {
		super(app);
	}

	onOpen(): void {
		this.component.load();
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("claude-agent-memory-preview-modal");

		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("code", { text: this.filePath, cls: "claude-agent-config-path" });

		const body = contentEl.createDiv({ cls: "claude-agent-memory-preview-body" });

		if (!this.markdown.trim()) {
			body.createEl("p", { text: "File is empty.", cls: "setting-item-description" });
		} else {
			void MarkdownRenderer.render(this.app, this.markdown, body, "", this.component);
		}
	}

	onClose(): void {
		this.component.unload();
		this.contentEl.empty();
	}
}
