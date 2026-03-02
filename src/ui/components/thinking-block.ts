import { setIcon } from "obsidian";

export class ThinkingBlockRenderer {
	static render(parentEl: HTMLElement, thinking: string, collapsed = true): HTMLElement {
		const block = parentEl.createDiv({ cls: "claude-agent-thinking-block" });
		const header = block.createDiv({ cls: "claude-agent-thinking-header" });

		const toggleIcon = header.createSpan({ cls: "claude-agent-thinking-toggle" });
		setIcon(toggleIcon, collapsed ? "chevron-right" : "chevron-down");

		header.createSpan({ cls: "claude-agent-thinking-label", text: "Thinking..." });

		const contentEl = block.createDiv({ cls: "claude-agent-thinking-content" });
		contentEl.setText(thinking);

		if (collapsed) {
			contentEl.style.display = "none";
		}

		header.addEventListener("click", () => {
			const isHidden = contentEl.style.display === "none";
			contentEl.style.display = isHidden ? "" : "none";
			toggleIcon.empty();
			setIcon(toggleIcon, isHidden ? "chevron-down" : "chevron-right");
		});

		return block;
	}

	static appendToken(blockEl: HTMLElement, token: string): void {
		const contentEl = blockEl.querySelector(".claude-agent-thinking-content");
		if (contentEl) {
			contentEl.textContent = (contentEl.textContent ?? "") + token;
		}
	}
}
