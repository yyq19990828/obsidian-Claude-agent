import { setIcon } from "obsidian";

export interface AskUserQuestion {
	question: string;
	options?: { label: string; description?: string }[];
}

/**
 * Inline card for AskUserQuestion tool calls.
 * Renders the question with optional buttons and a text input fallback.
 * Returns a Promise that resolves with the user's answer.
 */
export function renderAskUserCard(
	parentEl: HTMLElement,
	question: AskUserQuestion,
): Promise<string> {
	return new Promise((resolve) => {
		const card = parentEl.createDiv({ cls: "claude-agent-ask-user-card" });

		/* Question header */
		const header = card.createDiv({ cls: "claude-agent-ask-user-header" });
		const iconEl = header.createSpan({ cls: "claude-agent-ask-user-icon" });
		setIcon(iconEl, "help-circle");
		header.createSpan({ cls: "claude-agent-ask-user-question", text: question.question });

		let resolved = false;
		const finish = (answer: string) => {
			if (resolved) return;
			resolved = true;
			card.addClass("is-answered");
			/* Remove interactive elements */
			const inputs = card.querySelectorAll("button, input, textarea");
			inputs.forEach(el => (el as HTMLElement).setAttribute("disabled", "true"));
			resolve(answer);
		};

		/* Option buttons */
		if (question.options && question.options.length > 0) {
			const optionsEl = card.createDiv({ cls: "claude-agent-ask-user-options" });
			for (const opt of question.options) {
				const btn = optionsEl.createEl("button", {
					cls: "claude-agent-ask-user-option",
					text: opt.label,
				});
				if (opt.description) {
					btn.setAttribute("title", opt.description);
				}
				btn.addEventListener("click", () => finish(opt.label));
			}
		}

		/* Text input for custom answer */
		const inputRow = card.createDiv({ cls: "claude-agent-ask-user-input-row" });
		const input = inputRow.createEl("input", {
			cls: "claude-agent-ask-user-input",
			attr: { type: "text", placeholder: "Type your answer..." },
		});
		const submitBtn = inputRow.createEl("button", {
			cls: "claude-agent-ask-user-submit",
		});
		setIcon(submitBtn, "arrow-up");

		submitBtn.addEventListener("click", () => {
			const value = input.value.trim();
			if (value) finish(value);
		});
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				const value = input.value.trim();
				if (value) finish(value);
			}
		});

		/* Skip button */
		const skipBtn = card.createEl("button", {
			cls: "claude-agent-ask-user-skip",
			text: "Skip",
		});
		skipBtn.addEventListener("click", () => finish(""));
	});
}
