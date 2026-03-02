import { setIcon } from "obsidian";
import type { ToolCall } from "../types";

export class ToolApprovalUI {
	constructor(private readonly containerEl: HTMLElement) {}

	requestApproval(toolCall: ToolCall): Promise<boolean> {
		return new Promise((resolve) => {
			const card = this.containerEl.createDiv({ cls: "claude-agent-approval-card" });

			/* ── Header: icon + tool name ── */
			const header = card.createDiv({ cls: "claude-agent-approval-header" });
			const iconEl = header.createSpan({ cls: "claude-agent-approval-icon" });
			setIcon(iconEl, this.getToolIcon(toolCall.toolName));
			header.createSpan({ cls: "claude-agent-approval-tool-name", text: toolCall.toolName });

			/* ── File path (if present) ── */
			if (toolCall.filePath) {
				card.createDiv({ cls: "claude-agent-approval-path", text: toolCall.filePath });
			}

			/* ── Parameters ── */
			const input = toolCall.input;
			if (input && Object.keys(input).length > 0) {
				const paramsEl = card.createDiv({ cls: "claude-agent-approval-params" });

				const hasOldNew = "old_string" in input && "new_string" in input;

				for (const [key, value] of Object.entries(input)) {
					/* Diff display for old_string/new_string */
					if (hasOldNew && (key === "old_string" || key === "new_string")) {
						if (key === "old_string") {
							const diffEl = paramsEl.createDiv({ cls: "claude-agent-approval-diff" });
							const oldCol = diffEl.createDiv({ cls: "claude-agent-approval-diff-old" });
							oldCol.createDiv({ cls: "claude-agent-approval-diff-label", text: "old_string" });
							const oldPre = oldCol.createEl("pre");
							oldPre.setText(String(input.old_string ?? ""));

							const newCol = diffEl.createDiv({ cls: "claude-agent-approval-diff-new" });
							newCol.createDiv({ cls: "claude-agent-approval-diff-label", text: "new_string" });
							const newPre = newCol.createEl("pre");
							newPre.setText(String(input.new_string ?? ""));
						}
						continue;
					}

					const row = paramsEl.createDiv({ cls: "claude-agent-approval-param-row" });
					const keyEl = row.createSpan({ cls: "claude-agent-approval-param-key", text: `${key}:` });

					const strValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);

					/* command field: terminal style */
					if (key === "command") {
						const codeBlock = row.createEl("code", { cls: "claude-agent-approval-command" });
						codeBlock.setText(strValue);
						continue;
					}

					/* Short vs long value */
					if (strValue.length <= 100) {
						row.createSpan({ cls: "claude-agent-approval-param-value", text: ` ${strValue}` });
					} else {
						const truncated = strValue.slice(0, 100) + "...";
						const valueEl = row.createSpan({ cls: "claude-agent-approval-param-value", text: ` ${truncated}` });
						const expandEl = row.createDiv({ cls: "claude-agent-approval-param-full" });
						expandEl.style.display = "none";
						const pre = expandEl.createEl("pre");
						pre.setText(strValue);
						valueEl.addClass("claude-agent-approval-param-expandable");
						valueEl.addEventListener("click", () => {
							const isHidden = expandEl.style.display === "none";
							expandEl.style.display = isHidden ? "" : "none";
							valueEl.setText(isHidden ? ` ${key}: (click to collapse)` : ` ${truncated}`);
						});
					}
				}
			}

			/* ── Actions ── */
			const actions = card.createDiv({ cls: "claude-agent-approval-actions" });
			let resolved = false;

			const finish = (approved: boolean): void => {
				if (resolved) return;
				resolved = true;
				card.remove();
				resolve(approved);
			};

			const approveBtn = actions.createEl("button", { cls: "claude-agent-approval-btn claude-agent-approval-btn-approve" });
			const approveIcon = approveBtn.createSpan();
			setIcon(approveIcon, "check");
			approveBtn.createSpan({ text: "Approve" });
			approveBtn.addEventListener("click", () => finish(true));

			const rejectBtn = actions.createEl("button", { cls: "claude-agent-approval-btn claude-agent-approval-btn-reject" });
			const rejectIcon = rejectBtn.createSpan();
			setIcon(rejectIcon, "x");
			rejectBtn.createSpan({ text: "Reject" });
			rejectBtn.addEventListener("click", () => finish(false));
		});
	}

	private getToolIcon(toolName: string): string {
		const lower = toolName.toLowerCase();
		if (lower.includes("read")) return "file-text";
		if (lower.includes("write")) return "file-plus";
		if (lower.includes("edit")) return "file-edit";
		if (lower.includes("bash")) return "terminal";
		if (lower.includes("glob")) return "search";
		if (lower.includes("grep")) return "search";
		if (lower.includes("web")) return "globe";
		return "wrench";
	}
}
