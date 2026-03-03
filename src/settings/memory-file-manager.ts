import type ClaudeAgentPlugin from "../main";
import type { SchemaKeyNode } from "./config-file-schema";

export function refreshSettingsTab(plugin: ClaudeAgentPlugin): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const setting = (plugin.app as any).setting;
	setting?.close();
	setting?.open();
}

/** Set a nested value in an object by dot-path */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
	const parts = path.split(".");
	let current: Record<string, unknown> = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i]!;
		if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}
	current[parts[parts.length - 1]!] = value;
}

/** Parse a value string into the right JS type based on schema */
export function parseValueBySchema(valueStr: string, node: SchemaKeyNode | undefined): unknown {
	if (!node) {
		// best guess
		if (valueStr === "true") return true;
		if (valueStr === "false") return false;
		const num = Number(valueStr);
		if (!isNaN(num) && valueStr.trim() !== "") return num;
		try { return JSON.parse(valueStr) as unknown; } catch { /* fallthrough */ }
		return valueStr;
	}

	switch (node.type) {
		case "boolean":
			return valueStr === "true";
		case "number":
			return Number(valueStr) || 0;
		case "enum":
			return valueStr;
		case "array":
			try { return JSON.parse(valueStr) as unknown; } catch { return [valueStr]; }
		case "object":
			try { return JSON.parse(valueStr) as unknown; } catch { return {}; }
		default:
			return valueStr;
	}
}

export function openFileInDefaultEditor(filePath: string): void {
	import("node:child_process").then(({ exec }) => {
		exec(`xdg-open "${filePath}"`, (err) => {
			if (err) console.warn("[Claude Agent] Failed to open file:", err);
		});
	}).catch(() => {
		/* fallback: do nothing */
	});
}
