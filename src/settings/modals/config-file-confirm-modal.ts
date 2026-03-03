import { Modal } from "obsidian";

export class ConfigFileConfirmModal extends Modal {
	private resolve: ((value: boolean) => void) | null = null;

	constructor(
		app: import("obsidian").App,
		private readonly filePath: string,
		private readonly layerName: string,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: `Create ${this.layerName} config file` });
		contentEl.createEl("p", { text: "This will create a new configuration file at:" });
		contentEl.createEl("code", { text: this.filePath, cls: "claude-agent-config-path" });
		contentEl.createEl("p", { text: "The file will start empty. You can then edit it to override specific settings." });

		const buttonRow = contentEl.createDiv({ cls: "modal-button-container" });
		buttonRow.createEl("button", { text: "Cancel" }).addEventListener("click", () => {
			this.resolve?.(false);
			this.close();
		});
		buttonRow.createEl("button", { text: "Create", cls: "mod-cta" }).addEventListener("click", () => {
			this.resolve?.(true);
			this.close();
		});
	}

	onClose(): void {
		this.resolve?.(false);
		this.resolve = null;
		this.contentEl.empty();
	}

	awaitResult(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
