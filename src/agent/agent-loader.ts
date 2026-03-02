import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConfigLayerToggles } from "../types";

/**
 * A filesystem-loaded agent definition parsed from a `.md` file.
 * File name (minus `.md`) = agent name; file body = prompt.
 * Optional YAML frontmatter overrides description, model, tools, maxTurns.
 */
export interface FileAgentDef {
	name: string;
	description: string;
	prompt: string;
	model: "sonnet" | "opus" | "haiku" | "inherit";
	tools: string[];
	maxTurns: number;
	/** Which layer this definition came from */
	source: "user" | "project" | "custom";
	/** Absolute path to the source `.md` file */
	filePath: string;
}

interface FrontmatterData {
	description?: string;
	model?: string;
	tools?: string | string[];
	maxTurns?: number;
}

/**
 * Parse optional YAML frontmatter from a markdown string.
 * Returns parsed data and remaining body (the prompt).
 */
function parseFrontmatter(raw: string): { data: FrontmatterData; body: string } {
	const trimmed = raw.trimStart();
	if (!trimmed.startsWith("---")) {
		return { data: {}, body: raw };
	}

	const endIdx = trimmed.indexOf("\n---", 3);
	if (endIdx === -1) {
		return { data: {}, body: raw };
	}

	const yamlBlock = trimmed.slice(3, endIdx).trim();
	const body = trimmed.slice(endIdx + 4).trim();
	const data: FrontmatterData = {};

	for (const line of yamlBlock.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;

		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();

		switch (key) {
			case "description":
				data.description = value;
				break;
			case "model":
				if (["sonnet", "opus", "haiku", "inherit"].includes(value)) {
					data.model = value;
				}
				break;
			case "tools":
				// Support both comma-separated string and YAML list notation
				if (value.startsWith("[") && value.endsWith("]")) {
					data.tools = value.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
				} else if (value) {
					data.tools = value.split(",").map((s) => s.trim()).filter(Boolean);
				}
				break;
			case "maxTurns":
				{
					const n = parseInt(value, 10);
					if (!isNaN(n) && n >= 0) data.maxTurns = n;
				}
				break;
		}
	}

	return { data, body };
}

/**
 * Load all `.md` agent definitions from a single directory.
 */
function loadAgentsFromDir(dirPath: string, source: "user" | "project" | "custom"): FileAgentDef[] {
	if (!existsSync(dirPath)) return [];

	const agents: FileAgentDef[] = [];

	let entries: string[];
	try {
		entries = readdirSync(dirPath);
	} catch {
		return [];
	}

	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;

		const filePath = path.join(dirPath, entry);
		const name = entry.slice(0, -3); // strip .md
		if (!name) continue;

		let raw: string;
		try {
			raw = readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { data, body } = parseFrontmatter(raw);

		agents.push({
			name,
			description: data.description ?? "",
			prompt: body,
			model: (data.model as FileAgentDef["model"]) ?? "inherit",
			tools: Array.isArray(data.tools) ? data.tools : [],
			maxTurns: data.maxTurns ?? 0,
			source,
			filePath,
		});
	}

	return agents;
}

/**
 * Load and merge agents from the three filesystem layers.
 * Higher-priority layers override lower-priority ones by name.
 *
 * Priority: user (low) < project (mid) < custom (high)
 */
export function loadFileAgents(
	homeDir: string,
	vaultDir: string,
	pluginDir: string,
	agentConfigSubdir: string,
	toggles: ConfigLayerToggles,
): FileAgentDef[] {
	const byName = new Map<string, FileAgentDef>();

	// Layer 1 (lowest): user — ~/.claude/agents/*.md
	if (toggles.userEnabled) {
		const userDir = path.join(homeDir, ".claude", "agents");
		for (const agent of loadAgentsFromDir(userDir, "user")) {
			byName.set(agent.name, agent);
		}
	}

	// Layer 2 (mid): project — <vault>/.claude/agents/*.md
	if (toggles.projectEnabled) {
		const projectDir = path.join(vaultDir, ".claude", "agents");
		for (const agent of loadAgentsFromDir(projectDir, "project")) {
			byName.set(agent.name, agent);
		}
	}

	// Layer 3 (highest): custom — <plugin-dir>/<agentConfigSubdir>/agents/*.md
	if (toggles.customEnabled) {
		const subdir = agentConfigSubdir || ".agent";
		const resolved = path.resolve(pluginDir, subdir);
		// Path traversal safety
		if (resolved.startsWith(pluginDir)) {
			const customDir = path.join(resolved, "agents");
			for (const agent of loadAgentsFromDir(customDir, "custom")) {
				byName.set(agent.name, agent);
			}
		}
	}

	return Array.from(byName.values());
}

/**
 * Result of loading agents grouped by source layer (for UI display).
 * Each layer contains all agents loaded from that directory,
 * WITHOUT cross-layer dedup — the UI shows every layer independently.
 */
export interface FileAgentsByLayer {
	custom: FileAgentDef[];
	project: FileAgentDef[];
	user: FileAgentDef[];
}

/**
 * Load agents from each layer separately (for display in settings).
 * Returns agents grouped by layer, highest priority first.
 */
export function loadFileAgentsByLayer(
	homeDir: string,
	vaultDir: string,
	pluginDir: string,
	agentConfigSubdir: string,
	toggles: ConfigLayerToggles,
): FileAgentsByLayer {
	const result: FileAgentsByLayer = { custom: [], project: [], user: [] };

	if (toggles.userEnabled) {
		const userDir = path.join(homeDir, ".claude", "agents");
		result.user = loadAgentsFromDir(userDir, "user");
	}

	if (toggles.projectEnabled) {
		const projectDir = path.join(vaultDir, ".claude", "agents");
		result.project = loadAgentsFromDir(projectDir, "project");
	}

	if (toggles.customEnabled) {
		const subdir = agentConfigSubdir || ".agent";
		const resolved = path.resolve(pluginDir, subdir);
		if (resolved.startsWith(pluginDir)) {
			const customDir = path.join(resolved, "agents");
			result.custom = loadAgentsFromDir(customDir, "custom");
		}
	}

	return result;
}
