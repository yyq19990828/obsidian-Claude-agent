import { setIcon } from "obsidian";
import type { ToolCall } from "../../types";

function safeString(val: unknown): string {
	if (typeof val === "string") return val;
	if (val == null) return "";
	return JSON.stringify(val);
}

/**
 * Renders a specialized card for Task (subagent) tool calls.
 * Shows agent name, status, and optional nested content.
 */
export function renderSubagentCard(parentEl: HTMLElement, toolCall: ToolCall): void {
	const card = parentEl.createDiv({ cls: "claude-agent-subagent-card" });

	/* Header */
	const header = card.createDiv({ cls: "claude-agent-subagent-header claude-agent-subagent-clickable" });

	const iconEl = header.createSpan({ cls: "claude-agent-subagent-icon" });
	setIcon(iconEl, "bot");

	const input = toolCall.input ?? {};
	const agentName = safeString(input.subagent_type) || safeString(input.description) || "Subagent";
	header.createSpan({ cls: "claude-agent-subagent-name", text: agentName });

	/* Status indicator */
	const statusEl = header.createSpan({ cls: "claude-agent-subagent-status" });
	if (toolCall.status === "executed") {
		statusEl.addClass("is-complete");
		setIcon(statusEl, "check");
	} else if (toolCall.status === "pending") {
		statusEl.addClass("is-running");
		const spinner = statusEl.createSpan({ cls: "claude-agent-subagent-spinner" });
		spinner.setText("");
	} else {
		statusEl.addClass("is-failed");
		setIcon(statusEl, "x");
	}

	/* Prompt preview (collapsed by default) */
	const prompt = safeString(input.prompt);
	if (prompt) {
		const previewEl = card.createDiv({ cls: "claude-agent-subagent-preview is-collapsed" });
		previewEl.setText(prompt.length > 200 ? prompt.slice(0, 200) + "..." : prompt);

		header.addEventListener("click", () => {
			previewEl.toggleClass("is-collapsed", !previewEl.hasClass("is-collapsed"));
		});
	}

	/* Result preview */
	if (toolCall.result) {
		const resultEl = card.createDiv({ cls: "claude-agent-subagent-result is-collapsed" });
		const resultText = typeof toolCall.result === "string" ? toolCall.result : JSON.stringify(toolCall.result);
		resultEl.setText(resultText.length > 300 ? resultText.slice(0, 300) + "..." : resultText);

		if (!prompt) {
			header.addEventListener("click", () => {
				resultEl.toggleClass("is-collapsed", !resultEl.hasClass("is-collapsed"));
			});
		}
	}
}
