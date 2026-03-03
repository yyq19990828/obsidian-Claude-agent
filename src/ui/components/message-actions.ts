import { Menu, setIcon } from "obsidian";

export interface MessageActionHandlers {
	onCopyRaw: (rawMarkdown: string) => void;
	onRegenerate: (sourceUserText: string) => void;
	onFork?: (messageIndex: number) => void;
}

export function renderAssistantActions(
	rowEl: HTMLElement,
	rawMarkdown: string,
	sourceUserText: string,
	actions: MessageActionHandlers,
	messageIndex?: number,
): void {
	const actionBar = rowEl.createDiv({ cls: "claude-agent-message-actions claude-agent-assistant-actions" });
	const copyButton = actionBar.createEl("button", {
		cls: "claude-agent-message-action-button",
		attr: {
			type: "button",
			"aria-label": "Copy raw message",
			"data-tooltip": "Copy raw message",
		},
	});
	setIcon(copyButton, "copy");
	copyButton.addEventListener("click", () => actions.onCopyRaw(rawMarkdown));

	const regenerateButton = actionBar.createEl("button", {
		cls: "claude-agent-message-action-button",
		attr: {
			type: "button",
			"aria-label": "Regenerate response",
			"data-tooltip": "Regenerate",
		},
	});
	setIcon(regenerateButton, "refresh-cw");
	regenerateButton.addEventListener("click", () => actions.onRegenerate(sourceUserText));

	/* Fork button */
	if (actions.onFork && messageIndex != null) {
		const forkButton = actionBar.createEl("button", {
			cls: "claude-agent-message-action-button",
			attr: {
				type: "button",
				"aria-label": "Fork conversation from here",
				"data-tooltip": "Fork",
			},
		});
		setIcon(forkButton, "git-branch");
		forkButton.addEventListener("click", (e) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle("Fork to new tab")
					.setIcon("plus")
					.onClick(() => actions.onFork?.(messageIndex));
			});
			menu.showAtMouseEvent(e);
		});
	}
}

export function renderUserActions(
	rowEl: HTMLElement,
	rawText: string,
	actions: Pick<MessageActionHandlers, "onCopyRaw">,
): void {
	const actionBar = rowEl.createDiv({ cls: "claude-agent-message-actions claude-agent-user-actions" });
	const copyButton = actionBar.createEl("button", {
		cls: "claude-agent-message-action-button",
		attr: {
			type: "button",
			"aria-label": "Copy message",
			"data-tooltip": "Copy message",
		},
	});
	setIcon(copyButton, "copy");
	copyButton.addEventListener("click", () => actions.onCopyRaw(rawText));
}
