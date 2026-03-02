import { Modal, App, Setting } from "obsidian";
import type { SlashCommand } from "../../types";

export class SlashCommandModal extends Modal {
	private result: SlashCommand;
	private onSubmit: (cmd: SlashCommand) => void;

	constructor(app: App, onSubmit: (cmd: SlashCommand) => void, existing?: SlashCommand) {
		super(app);
		this.onSubmit = onSubmit;
		this.result = existing ?? {
			id: crypto.randomUUID(),
			name: "",
			prompt: "",
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: this.result.name ? "Edit command" : "Add command" });

		new Setting(contentEl)
			.setName("Command name")
			.addText((text) => {
				text.setPlaceholder("/summarize").setValue(this.result.name).onChange((v) => { this.result.name = v.trim(); });
			});

		new Setting(contentEl)
			.setName("Prompt template")
			.addTextArea((text) => {
				text
					.setPlaceholder("Summarize the current note...")
					.setValue(this.result.prompt)
					.onChange((v) => { this.result.prompt = v; });
				text.inputEl.rows = 5;
			});

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText("Save").setCta().onClick(() => {
				this.onSubmit(this.result);
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
