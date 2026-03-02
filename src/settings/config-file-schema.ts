import { z } from "zod";

const ToolPermissionSchema = z.enum(["allow", "ask", "deny"]);

const SdkToolTogglesSchema = z.object({
	Write: ToolPermissionSchema,
	Edit: ToolPermissionSchema,
	Bash: ToolPermissionSchema,
	Skill: ToolPermissionSchema,
	WebFetch: ToolPermissionSchema,
	WebSearch: ToolPermissionSchema,
	NotebookEdit: ToolPermissionSchema,
}).partial();

const SubagentConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	prompt: z.string(),
	model: z.enum(["sonnet", "opus", "haiku", "inherit"]),
	tools: z.array(z.string()),
	maxTurns: z.number().min(0),
	enabled: z.boolean(),
});

const McpServerConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	command: z.string(),
	args: z.array(z.string()),
	env: z.record(z.string(), z.string()),
	enabled: z.boolean(),
});

const PermissionsSchema = z.object({
	allow: z.array(z.string()),
	deny: z.array(z.string()),
}).partial();

export const AgentConfigFileSchema = z.object({
	model: z.string(),
	thinkingBudget: z.enum(["off", "normal", "extended"]),
	safeMode: z.boolean(),
	maxContextSize: z.number().positive(),
	env: z.record(z.string(), z.string()),
	permissions: PermissionsSchema,
	sdkToolToggles: SdkToolTogglesSchema,
	mcpServers: z.array(McpServerConfigSchema),
	subagents: z.array(SubagentConfigSchema),
	commandBlacklist: z.array(z.string()),
	allowedPaths: z.array(z.string()),
	permissionMode: z.enum(["auto_approve", "confirm", "plan_only"]),
	confirmFileOperations: z.boolean(),
	maxMessagesPerConversation: z.number().positive(),
}).partial();

export type AgentConfigFile = z.infer<typeof AgentConfigFileSchema>;

/**
 * Schema key tree for autocomplete in the config editor.
 * Each entry: { key, type, children?, enumValues? }
 */
export interface SchemaKeyNode {
	key: string;
	type: "string" | "number" | "boolean" | "array" | "object" | "enum";
	enumValues?: string[];
	children?: SchemaKeyNode[];
}

export const CONFIG_SCHEMA_KEYS: SchemaKeyNode[] = [
	/* ── Core model & behavior ── */
	{ key: "model", type: "string" },
	{ key: "availableModels", type: "array" },
	{ key: "effortLevel", type: "enum", enumValues: ["low", "medium", "high"] },
	{ key: "fastMode", type: "boolean" },
	{ key: "language", type: "string" },
	{ key: "outputStyle", type: "enum", enumValues: ["concise", "normal", "verbose"] },
	{ key: "attribution", type: "boolean" },

	/* ── Plugin's own settings ── */
	{ key: "thinkingBudget", type: "enum", enumValues: ["off", "normal", "extended"] },
	{ key: "safeMode", type: "boolean" },
	{ key: "maxContextSize", type: "number" },
	{ key: "permissionMode", type: "enum", enumValues: ["auto_approve", "confirm", "plan_only"] },
	{ key: "confirmFileOperations", type: "boolean" },
	{ key: "maxMessagesPerConversation", type: "number" },

	/* ── Environment ── */
	{ key: "env", type: "object" },

	/* ── Permissions (official Claude Code schema) ── */
	{ key: "permissions", type: "object", children: [
		{ key: "allow", type: "array" },
		{ key: "deny", type: "array" },
		{ key: "ask", type: "array" },
		{ key: "defaultMode", type: "enum", enumValues: ["allowEdits", "plan", "bypassPermissions"] },
		{ key: "additionalDirectories", type: "array" },
	]},

	/* ── Hooks ── */
	{ key: "hooks", type: "object", children: [
		{ key: "PreToolUse", type: "array" },
		{ key: "PostToolUse", type: "array" },
		{ key: "Notification", type: "array" },
		{ key: "Stop", type: "array" },
		{ key: "SubagentStop", type: "array" },
	]},

	/* ── SDK tool toggles ── */
	{ key: "sdkToolToggles", type: "object", children: [
		{ key: "Write", type: "enum", enumValues: ["allow", "ask", "deny"] },
		{ key: "Edit", type: "enum", enumValues: ["allow", "ask", "deny"] },
		{ key: "Bash", type: "enum", enumValues: ["allow", "ask", "deny"] },
		{ key: "Skill", type: "enum", enumValues: ["allow", "ask", "deny"] },
		{ key: "WebFetch", type: "enum", enumValues: ["allow", "ask", "deny"] },
		{ key: "WebSearch", type: "enum", enumValues: ["allow", "ask", "deny"] },
		{ key: "NotebookEdit", type: "enum", enumValues: ["allow", "ask", "deny"] },
	]},

	/* ── MCP servers ── */
	{ key: "mcpServers", type: "array", children: [
		{ key: "id", type: "string" },
		{ key: "name", type: "string" },
		{ key: "command", type: "string" },
		{ key: "args", type: "array" },
		{ key: "env", type: "object" },
		{ key: "enabled", type: "boolean" },
	]},
	{ key: "enableAllProjectMcpServers", type: "boolean" },

	/* ── Subagents ── */
	{ key: "subagents", type: "array", children: [
		{ key: "id", type: "string" },
		{ key: "name", type: "string" },
		{ key: "description", type: "string" },
		{ key: "prompt", type: "string" },
		{ key: "model", type: "enum", enumValues: ["sonnet", "opus", "haiku", "inherit"] },
		{ key: "tools", type: "array" },
		{ key: "maxTurns", type: "number" },
		{ key: "enabled", type: "boolean" },
	]},

	/* ── Plugins ── */
	{ key: "enabledPlugins", type: "array" },

	/* ── Memory & config ── */
	{ key: "autoMemoryEnabled", type: "boolean" },

	/* ── Sandbox ── */
	{ key: "sandbox", type: "enum", enumValues: ["docker", "none"] },

	/* ── UI & display ── */
	{ key: "statusLine", type: "object" },

	/* ── Updates & maintenance ── */
	{ key: "autoUpdatesChannel", type: "enum", enumValues: ["stable", "beta", "none"] },
	{ key: "cleanupPeriodDays", type: "number" },

	/* ── Legacy / plugin-specific ── */
	{ key: "commandBlacklist", type: "array" },
	{ key: "allowedPaths", type: "array" },
];

/** Flatten schema keys with dot-notation paths for autocomplete suggestions */
export function flattenSchemaKeys(nodes: SchemaKeyNode[], prefix = ""): string[] {
	const result: string[] = [];
	for (const node of nodes) {
		const fullKey = prefix ? `${prefix}.${node.key}` : node.key;
		result.push(fullKey);
		if (node.children) {
			result.push(...flattenSchemaKeys(node.children, fullKey));
		}
	}
	return result;
}

/** Find schema node by dot-path */
export function findSchemaNode(path: string): SchemaKeyNode | undefined {
	const parts = path.split(".");
	let nodes = CONFIG_SCHEMA_KEYS;
	let found: SchemaKeyNode | undefined;
	for (const part of parts) {
		found = nodes.find((n) => n.key === part);
		if (!found) return undefined;
		nodes = found.children ?? [];
	}
	return found;
}

export function parseConfigFile(raw: unknown): AgentConfigFile | null {
	const result = AgentConfigFileSchema.safeParse(raw);
	if (!result.success) {
		console.warn("[Claude Agent] Config file validation failed:", result.error.format());
		return null;
	}
	return result.data;
}
