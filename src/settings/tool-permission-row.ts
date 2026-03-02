import type { ToolPermission } from "../types";

interface PermOption {
	value: ToolPermission;
	icon: string;
	label: string;
	cls: string;
}

const PERM_OPTIONS: PermOption[] = [
	{ value: "allow", icon: "\u2713", label: "Allow", cls: "is-allow" },
	{ value: "ask", icon: "\u270b", label: "Ask", cls: "is-ask" },
	{ value: "deny", icon: "\u2298", label: "Deny", cls: "is-deny" },
];

export function renderToolPermRow(
	container: HTMLElement,
	name: string,
	description: string | undefined,
	current: ToolPermission,
	onChange: (value: ToolPermission) => void,
): void {
	const row = container.createDiv({ cls: "claude-agent-tool-perm-row" });

	const nameEl = row.createDiv({ cls: "claude-agent-tool-perm-name" });
	nameEl.createSpan({ text: name });
	if (description) {
		nameEl.createEl("small", { text: description, cls: "claude-agent-tool-perm-desc" });
	}

	const actions = row.createDiv({ cls: "claude-agent-tool-perm-actions" });

	for (const opt of PERM_OPTIONS) {
		const btn = actions.createEl("button", {
			cls: "claude-agent-tool-perm-btn",
			attr: { "aria-label": opt.label, title: opt.label },
		});
		btn.textContent = opt.icon;

		if (current === opt.value) {
			btn.addClass(opt.cls);
		}

		btn.addEventListener("click", () => {
			// Remove active class from siblings
			const siblings = actions.querySelectorAll(".claude-agent-tool-perm-btn");
			siblings.forEach((s) => {
				s.removeClass("is-allow", "is-ask", "is-deny");
			});
			btn.addClass(opt.cls);
			onChange(opt.value);
		});
	}
}
