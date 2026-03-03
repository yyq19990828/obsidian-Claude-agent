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

/** Deep merge saved data with defaults, stripping unknown keys from sub-objects */
export function mergeWithDefaults(saved: Partial<ClaudeAgentSettings>, migrated: Partial<ClaudeAgentSettings>): ClaudeAgentSettings {
	// Only keep keys that exist in the default shape (removes stale tool entries)
	const vaultPerms = { ...DEFAULT_VAULT_TOOL_PERMISSIONS };
	if (saved.vaultToolPermissions) {
		for (const key of Object.keys(DEFAULT_VAULT_TOOL_PERMISSIONS) as (keyof typeof DEFAULT_VAULT_TOOL_PERMISSIONS)[]) {
			if (key in saved.vaultToolPermissions) {
				vaultPerms[key] = saved.vaultToolPermissions[key];
			}
		}
	}

	return {
		...DEFAULT_SETTINGS,
		...saved,
		sdkToolToggles: migrated.sdkToolToggles ?? DEFAULT_SDK_TOOL_TOGGLES,
		vaultToolPermissions: vaultPerms,
		claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES, ...saved.claudeSettingSources },
		configLayerToggles: { ...DEFAULT_CONFIG_LAYER_TOGGLES, ...saved.configLayerToggles },
	};
}
