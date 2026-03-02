import { App, Modal } from "obsidian";

export class SuperModeConfirmModal extends Modal {
	private resolve: ((value: boolean) => void) | null = null;

	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Enable super mode" });

		contentEl.createEl("p", {
			text: "Super mode expands the agent's capabilities beyond the Obsidian vault. This includes:",
		});

		const list = contentEl.createEl("ul");
		list.createEl("li", { text: "File system access (read, write, edit files outside the vault)" });
		list.createEl("li", { text: "Terminal command execution (Bash)" });
		list.createEl("li", { text: "Web access (fetch and search)" });
		list.createEl("li", { text: "Loading .claude/ project and user configuration" });

		contentEl.createEl("p", {
			text: "Only enable super mode if you trust the agent with these capabilities.",
			cls: "mod-warning",
		});

		const buttonRow = contentEl.createDiv({ cls: "modal-button-container" });

		const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.resolve?.(false);
			this.close();
		});

		const enableBtn = buttonRow.createEl("button", { text: "Enable", cls: "mod-cta mod-warning" });
		enableBtn.addEventListener("click", () => {
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

export function requestSuperModeConfirmation(app: App): Promise<boolean> {
	const modal = new SuperModeConfirmModal(app);
	return modal.awaitResult();
}
