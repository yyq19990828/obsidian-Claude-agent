import { Modal, App, Setting } from "obsidian";
import type { McpServerConfig } from "../../types";

export class McpServerModal extends Modal {
	private result: McpServerConfig | null = null;
	private onSubmit: (config: McpServerConfig) => void;

	constructor(app: App, onSubmit: (config: McpServerConfig) => void, existing?: McpServerConfig) {
		super(app);
		this.onSubmit = onSubmit;
		this.result = existing ?? {
			id: crypto.randomUUID(),
			name: "",
			command: "",
			args: [],
			env: {},
			enabled: true,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: this.result?.name ? "Edit MCP server" : "Add MCP server" });

		const config = this.result!;

		new Setting(contentEl)
			.setName("Name")
			.addText((text) => {
				text.setPlaceholder("my-server").setValue(config.name).onChange((v) => { config.name = v.trim(); });
			});

		new Setting(contentEl)
			.setName("Command")
			.addText((text) => {
				text.setPlaceholder("npx -y @my/server").setValue(config.command).onChange((v) => { config.command = v.trim(); });
			});

		new Setting(contentEl)
			.setName("Arguments")
			.addText((text) => {
				text.setPlaceholder("--port 3000").setValue(config.args.join(" ")).onChange((v) => {
					config.args = v.split(" ").filter(Boolean);
				});
			});

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText("Save").setCta().onClick(() => {
				this.onSubmit(config);
				this.close();
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
