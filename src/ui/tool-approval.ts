import { ButtonComponent, setIcon } from "obsidian";
import type { ToolCall } from "../types";

export class ToolApprovalUI {
	constructor(private readonly containerEl: HTMLElement) {}

	requestApproval(toolCall: ToolCall): Promise<boolean> {
		return new Promise((resolve) => {
			const card = this.containerEl.createDiv({ cls: "claude-agent-tool-card is-pending" });
			const header = card.createDiv({ cls: "claude-agent-tool-card-header" });
			header.createSpan({ text: `Tool call: ${toolCall.toolName}` });

			if (toolCall.filePath) {
				card.createDiv({ cls: "claude-agent-tool-path", text: toolCall.filePath });
			}

			const preview = card.createEl("pre", { cls: "claude-agent-tool-preview" });
			preview.setText(JSON.stringify(toolCall.input, null, 2));

			const actions = card.createDiv({ cls: "claude-agent-tool-actions" });
			let resolved = false;

			const finish = (approved: boolean): void => {
				if (resolved) {
					return;
				}
				resolved = true;
				card.remove();
				resolve(approved);
			};

			const approveBtn = new ButtonComponent(actions)
				.setButtonText("Approve")
				.onClick(() => {
					finish(true);
				});
			setIcon(approveBtn.buttonEl, "check");

			const rejectBtn = new ButtonComponent(actions)
				.setButtonText("Reject")
				.setWarning()
				.onClick(() => {
					finish(false);
				});
			setIcon(rejectBtn.buttonEl, "x");
		});
	}
}
