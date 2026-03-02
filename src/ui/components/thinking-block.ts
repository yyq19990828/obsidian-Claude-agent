import { setIcon } from "obsidian";

export class ThinkingBlockRenderer {
	private static startTimeMap = new WeakMap<HTMLElement, number>();

	static render(parentEl: HTMLElement, thinking: string, collapsed = true): HTMLElement {
		const block = parentEl.createDiv({ cls: "claude-agent-thinking-block" });
		const header = block.createDiv({ cls: "claude-agent-thinking-header" });

		header.createSpan({ cls: "claude-agent-thinking-label", text: "Thinking..." });

		const contentEl = block.createDiv({ cls: "claude-agent-thinking-content" });
		contentEl.setText(thinking);
		contentEl.style.display = "none";

		header.addEventListener("click", () => {
			const isHidden = contentEl.style.display === "none";
			contentEl.style.display = isHidden ? "" : "none";
		});

		return block;
	}

	static startThinking(parentEl: HTMLElement): HTMLElement {
		const block = parentEl.createDiv({ cls: "claude-agent-thinking-block" });
		const header = block.createDiv({ cls: "claude-agent-thinking-header" });

		header.createSpan({ cls: "claude-agent-thinking-label", text: "Thinking..." });

		const contentEl = block.createDiv({ cls: "claude-agent-thinking-content" });
		contentEl.style.display = "none";

		this.startTimeMap.set(block, Date.now());

		header.addEventListener("click", () => {
			const isHidden = contentEl.style.display === "none";
			contentEl.style.display = isHidden ? "" : "none";
		});

		return block;
	}

	static finish(blockEl: HTMLElement): void {
		const startTime = this.startTimeMap.get(blockEl);
		const label = blockEl.querySelector(".claude-agent-thinking-label");
		if (label && startTime) {
			const seconds = Math.round((Date.now() - startTime) / 1000);
			label.textContent = `Thought for ${seconds}s`;
		}
		this.startTimeMap.delete(blockEl);
	}

	static appendToken(blockEl: HTMLElement, token: string): void {
		const contentEl = blockEl.querySelector(".claude-agent-thinking-content");
		if (contentEl) {
			contentEl.textContent = (contentEl.textContent ?? "") + token;
		}
	}
}
