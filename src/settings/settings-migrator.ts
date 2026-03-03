import { DEFAULT_SDK_TOOL_TOGGLES, DEFAULT_VAULT_TOOL_PERMISSIONS, DEFAULT_CLAUDE_SETTING_SOURCES, DEFAULT_CONFIG_LAYER_TOGGLES, DEFAULT_SETTINGS } from "../constants";
import type { ClaudeAgentSettings, ToolPermission } from "../types";

/** Migrate old boolean sdkToolToggles to ToolPermission */
export function migrateSettings(saved: Partial<ClaudeAgentSettings>): Partial<ClaudeAgentSettings> {
	const rawToggles = saved.sdkToolToggles as Record<string, boolean | ToolPermission> | undefined;
	const migratedToggles = { ...DEFAULT_SDK_TOOL_TOGGLES };
	if (rawToggles) {
		for (const [key, val] of Object.entries(rawToggles)) {
			if (key in migratedToggles) {
				if (typeof val === "boolean") {
					(migratedToggles as Record<string, ToolPermission>)[key] = val ? "allow" : "deny";
				} else {
					(migratedToggles as Record<string, ToolPermission>)[key] = val;
				}
			}
		}
	}
	return { sdkToolToggles: migratedToggles };
}

/** Deep merge saved data with defaults */
export function mergeWithDefaults(saved: Partial<ClaudeAgentSettings>, migrated: Partial<ClaudeAgentSettings>): ClaudeAgentSettings {
	return {
		...DEFAULT_SETTINGS,
		...saved,
		sdkToolToggles: migrated.sdkToolToggles ?? DEFAULT_SDK_TOOL_TOGGLES,
		vaultToolPermissions: { ...DEFAULT_VAULT_TOOL_PERMISSIONS, ...saved.vaultToolPermissions },
		claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES, ...saved.claudeSettingSources },
		configLayerToggles: { ...DEFAULT_CONFIG_LAYER_TOGGLES, ...saved.configLayerToggles },
	};
}
