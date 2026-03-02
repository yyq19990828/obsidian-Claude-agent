import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type {
	ClaudeAgentSettings,
	ConfigLayer,
	ResolvedSettings,
	SettingOverrideMap,
	SdkToolToggles,
	McpServerConfig,
	SubagentConfig,
} from "../types";
import { parseConfigFile, type AgentConfigFile } from "./config-file-schema";

export interface ConfigFileStatus {
	exists: boolean;
	path: string;
	readonly: boolean;
}

export class SettingsResolver {
	constructor(
		private readonly pluginDir: string,
		private readonly vaultDir: string,
		private readonly homeDir: string,
	) {}

	resolve(uiSettings: ClaudeAgentSettings): ResolvedSettings {
		const merged = JSON.parse(JSON.stringify(uiSettings)) as ClaudeAgentSettings;
		const overrides: SettingOverrideMap = {};
		const toggles = uiSettings.configLayerToggles;

		if (toggles.userEnabled) {
			const config = this.readLayer("user");
			if (config) this.mergeLayer(merged, overrides, config, "user");
		}

		if (toggles.projectEnabled) {
			const config = this.readLayer("project");
			if (config) this.mergeLayer(merged, overrides, config, "project");
		}

		if (toggles.customEnabled) {
			const config = this.readLayer("custom");
			if (config) this.mergeLayer(merged, overrides, config, "custom");
		}

		return { merged, overrides };
	}

	getConfigFileStatus(layer: "user" | "project" | "custom", agentConfigSubdir: string): ConfigFileStatus {
		const filePath = this.getLayerPath(layer, agentConfigSubdir);
		return {
			exists: existsSync(filePath),
			path: filePath,
			readonly: layer === "user",
		};
	}

	createConfigFile(layer: "project" | "custom", agentConfigSubdir: string): boolean {
		const filePath = this.getLayerPath(layer, agentConfigSubdir);

		if (layer === "custom") {
			const resolved = path.resolve(this.pluginDir, agentConfigSubdir);
			if (!resolved.startsWith(this.pluginDir)) {
				console.warn("[Claude Agent] Path traversal blocked:", agentConfigSubdir);
				return false;
			}
		}

		try {
			const dir = path.dirname(filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			if (!existsSync(filePath)) {
				writeFileSync(filePath, JSON.stringify({}, null, 2), "utf-8");
			}
			return true;
		} catch (err) {
			console.warn("[Claude Agent] Failed to create config file:", err);
			return false;
		}
	}

	private getLayerPath(layer: "user" | "project" | "custom", agentConfigSubdir?: string): string {
		switch (layer) {
			case "user":
				return path.join(this.homeDir, ".claude", "settings.json");
			case "project":
				return path.join(this.vaultDir, ".claude", "settings.json");
			case "custom": {
				const subdir = agentConfigSubdir ?? ".agent";
				const resolved = path.resolve(this.pluginDir, subdir);
				if (!resolved.startsWith(this.pluginDir)) {
					return path.join(this.pluginDir, ".agent", "settings.json");
				}
				return path.join(resolved, "settings.json");
			}
		}
	}

	/** Read the raw JSON object from a layer file (for UI display) */
	readLayerRaw(layer: "user" | "project" | "custom", agentConfigSubdir?: string): Record<string, unknown> | null {
		const filePath = this.getLayerPath(layer, agentConfigSubdir);
		if (!existsSync(filePath)) return null;
		try {
			return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	/** Write a JSON object to a layer file (project/custom only) */
	writeLayerConfig(layer: "project" | "custom", data: Record<string, unknown>, agentConfigSubdir: string): boolean {
		const filePath = this.getLayerPath(layer, agentConfigSubdir);

		if (layer === "custom") {
			const resolved = path.resolve(this.pluginDir, agentConfigSubdir);
			if (!resolved.startsWith(this.pluginDir)) {
				console.warn("[Claude Agent] Path traversal blocked:", agentConfigSubdir);
				return false;
			}
		}

		try {
			const dir = path.dirname(filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
			return true;
		} catch (err) {
			console.warn("[Claude Agent] Failed to write config file:", err);
			return false;
		}
	}

	private readLayer(layer: "user" | "project" | "custom"): AgentConfigFile | null {
		const filePath = this.getLayerPath(layer);
		if (!existsSync(filePath)) return null;

		try {
			const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
			return parseConfigFile(raw);
		} catch (err) {
			console.warn(`[Claude Agent] Failed to read ${layer} config at ${filePath}:`, err);
			return null;
		}
	}

	private mergeLayer(
		target: ClaudeAgentSettings,
		overrides: SettingOverrideMap,
		config: AgentConfigFile,
		layer: ConfigLayer,
	): void {
		/* Scalar fields */
		const scalars: (keyof AgentConfigFile)[] = [
			"model", "thinkingBudget", "safeMode", "maxContextSize",
			"permissionMode", "confirmFileOperations", "maxMessagesPerConversation",
		];
		for (const key of scalars) {
			if (config[key] !== undefined) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(target as any)[key] = config[key];
				(overrides as Record<string, ConfigLayer>)[key] = layer;
			}
		}

		/* envVars: shallow merge */
		if (config.env) {
			target.envVars = { ...target.envVars, ...(config.env as Record<string, string>) };
			overrides.envVars = layer;
		}

		/* sdkToolToggles: key-level merge */
		if (config.sdkToolToggles) {
			const partial = config.sdkToolToggles as Partial<SdkToolToggles>;
			for (const [k, v] of Object.entries(partial)) {
				if (v !== undefined) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(target.sdkToolToggles as any)[k] = v;
				}
			}
			overrides.sdkToolToggles = layer;
		}

		/* mcpServers: merge by name, dedup */
		if (config.mcpServers && config.mcpServers.length > 0) {
			const byName = new Map<string, McpServerConfig>();
			for (const s of target.mcpServers) byName.set(s.name, s);
			for (const s of config.mcpServers) byName.set(s.name, s as unknown as McpServerConfig);
			target.mcpServers = Array.from(byName.values());
			overrides.mcpServers = layer;
		}

		/* subagents: merge by name, dedup */
		if (config.subagents && config.subagents.length > 0) {
			const byName = new Map<string, SubagentConfig>();
			for (const s of target.subagents) byName.set(s.name, s);
			for (const s of config.subagents) byName.set(s.name, s as unknown as SubagentConfig);
			target.subagents = Array.from(byName.values());
			overrides.subagents = layer;
		}

		/* commandBlacklist: union */
		if (config.commandBlacklist) {
			target.commandBlacklist = [...new Set([...target.commandBlacklist, ...config.commandBlacklist])];
			overrides.commandBlacklist = layer;
		}

		/* allowedPaths: union (with path safety check) */
		if (config.allowedPaths) {
			const safePaths = config.allowedPaths.filter((p) => {
				const resolved = path.resolve(this.pluginDir, p);
				return resolved.startsWith(this.pluginDir) || resolved.startsWith(this.vaultDir);
			});
			target.allowedPaths = [...new Set([...target.allowedPaths, ...safePaths])];
			overrides.allowedPaths = layer;
		}

		/* permissions.allow / deny → commandBlacklist / allowedPaths */
		if (config.permissions) {
			if (config.permissions.deny) {
				target.commandBlacklist = [...new Set([...target.commandBlacklist, ...config.permissions.deny])];
				overrides.commandBlacklist = layer;
			}
		}
	}
}
