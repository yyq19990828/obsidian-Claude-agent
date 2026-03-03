import { setIcon } from "obsidian";
import type { ToolCall } from "../../types";
import { renderInlineDiff, renderContentPreview } from "./inline-diff";
import { renderSubagentCard } from "./subagent-card";

interface ToolCardSettings {
	showDetailedTools: boolean;
}

export function renderToolCallCard(
	parentEl: HTMLElement,
	toolCall: ToolCall,
	settings: ToolCardSettings,
	onCopyRaw?: (text: string) => void,
): void {
	/* Subagent (Task) tool — delegate to specialized card */
	if (toolCall.toolName === "Task" || toolCall.toolName === "Agent") {
		renderSubagentCard(parentEl, toolCall);
		return;
	}

	const row = parentEl.createDiv({ cls: `claude-agent-tool-card is-${toolCall.status}` });

	const iconEl = row.createSpan({ cls: "claude-agent-tool-icon" });
	const iconName = getToolIcon(toolCall.toolName);
	setIcon(iconEl, iconName);

	const label = toolCall.filePath
		? `${toolCall.toolName}: ${truncatePath(toolCall.filePath)}`
		: toolCall.toolName;
	row.createSpan({ cls: "claude-agent-tool-name", text: label });

	const statusEl = row.createSpan({ cls: "claude-agent-tool-status" });
	if (toolCall.status === "executed") {
		statusEl.setText("\u2713");
		statusEl.addClass("is-executed");
	} else if (toolCall.status === "pending") {
		statusEl.setText("\u00b7\u00b7\u00b7");
		statusEl.addClass("is-pending");
	} else {
		statusEl.setText("\u2715");
		statusEl.addClass("is-rejected");
	}

	/* Detailed mode: expanded by default, clickable to collapse */
	if (settings.showDetailedTools) {
		row.addClass("claude-agent-tool-card-expandable");
		const detailEl = parentEl.createDiv({ cls: "claude-agent-tool-detail" });

		const lowerName = toolCall.toolName.toLowerCase();
		const isEditTool = lowerName === "edit" || lowerName === "edit_note"
			|| lowerName.endsWith("__edit_note");
		const isWriteTool = lowerName === "write" || lowerName === "write_note"
			|| lowerName.endsWith("__write_note");

		if (isEditTool && toolCall.input) {
			/* Render inline diff for Edit operations */
			const oldStr = String(toolCall.input.old_string ?? toolCall.input.oldText ?? "");
			const newStr = String(toolCall.input.new_string ?? toolCall.input.newText ?? "");
			if (oldStr || newStr) {
				renderInlineDiff(detailEl, oldStr, newStr);
			} else {
				renderFallbackDetail(detailEl, toolCall);
			}
		} else if (isWriteTool && toolCall.input) {
			/* Render content preview for Write operations */
			const content = String(toolCall.input.content ?? toolCall.input.text ?? "");
			const filePath = String(toolCall.input.file_path ?? toolCall.input.path ?? toolCall.filePath ?? "");
			if (content) {
				renderContentPreview(detailEl, content, filePath);
			} else {
				renderFallbackDetail(detailEl, toolCall);
			}
		} else {
			renderFallbackDetail(detailEl, toolCall);
		}

		row.addEventListener("click", () => {
			const isHidden = detailEl.style.display === "none";
			detailEl.style.display = isHidden ? "" : "none";
		});
	}
}

function renderFallbackDetail(detailEl: HTMLElement, toolCall: ToolCall): void {
	/* Input params */
	if (toolCall.input && Object.keys(toolCall.input).length > 0) {
		const paramsEl = detailEl.createDiv({ cls: "claude-agent-tool-detail-section" });
		paramsEl.createEl("strong", { text: "Input:" });
		const pre = paramsEl.createEl("pre", { cls: "claude-agent-tool-detail-pre" });
		pre.setText(JSON.stringify(toolCall.input, null, 2));
	}

	/* Result */
	if (toolCall.result) {
		const resultEl = detailEl.createDiv({ cls: "claude-agent-tool-detail-section" });
		resultEl.createEl("strong", { text: "Result:" });
		const pre = resultEl.createEl("pre", { cls: "claude-agent-tool-detail-pre" });
		pre.setText(typeof toolCall.result === "string" ? toolCall.result : JSON.stringify(toolCall.result, null, 2));
	}
}

export function getToolIcon(toolName: string): string {
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

export function truncatePath(filePath: string): string {
	if (filePath.length <= 40) return filePath;
	const parts = filePath.split("/");
	if (parts.length <= 2) return "..." + filePath.slice(-37);
	return ".../" + parts.slice(-2).join("/");
}
