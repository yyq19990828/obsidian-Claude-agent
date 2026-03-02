import type { ClaudeAgentSettings, SdkToolToggles, ClaudeSettingSources, VaultToolPermissions, ConfigLayerToggles } from "./types";

export const DEFAULT_SDK_TOOL_TOGGLES: SdkToolToggles = {
	Read: "deny",
	Write: "deny",
	Edit: "deny",
	Bash: "deny",
	Glob: "deny",
	Grep: "deny",
	Skill: "deny",
	WebFetch: "deny",
	WebSearch: "deny",
	NotebookEdit: "deny",
};

export const DEFAULT_VAULT_TOOL_PERMISSIONS: VaultToolPermissions = {
	read_note: "ask",
	write_note: "ask",
	modify_note: "ask",
};

export const DEFAULT_CONFIG_LAYER_TOGGLES: ConfigLayerToggles = {
	userEnabled: false,
	projectEnabled: false,
	customEnabled: false,
};

export const DEFAULT_CLAUDE_SETTING_SOURCES: ClaudeSettingSources = {
	projectSettings: false,
	projectMemory: false,
	userSettings: false,
	userMemory: false,
};

export const MODELS = [
	{ id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
	{ id: "claude-opus-4-6", label: "Claude Opus 4.6" },
	{ id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
	{ id: "claude-sonnet-4-5-20250514", label: "Claude Sonnet 4.5" },
] as const;

export const THINKING_BUDGETS: Record<string, number | null> = {
	off: null,
	normal: 10000,
	extended: 50000,
};

export const MAX_MESSAGES_PER_CONVERSATION = 200;

export const DEFAULT_SETTINGS: ClaudeAgentSettings = {
	/* General */
	userName: "",
	autoScroll: true,
	autoGenerateTitle: true,
	showDetailedThinking: false,
	showDetailedTools: false,

	/* Auth */
	apiKey: "",
	authMethod: "api_key",
	claudeCliPath: "",

	/* Model */
	model: "claude-sonnet-4-6",
	thinkingBudget: "off",

	/* Safety */
	confirmFileOperations: true,
	permissionMode: "confirm",
	commandBlacklist: [],
	allowedPaths: [],

	/* SDK access (safe/super mode) */
	safeMode: true,
	sdkToolToggles: { ...DEFAULT_SDK_TOOL_TOGGLES },
	vaultToolPermissions: { ...DEFAULT_VAULT_TOOL_PERMISSIONS },
	claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES },

	/* Context */
	maxContextSize: 50_000,

	/* MCP */
	mcpServers: [],

	/* Slash commands */
	slashCommands: [],

	/* Environment */
	envVars: {},

	/* Config file layers */
	agentConfigSubdir: ".agent",
	configLayerToggles: { ...DEFAULT_CONFIG_LAYER_TOGGLES },

	/* Advanced */
	maxMessagesPerConversation: MAX_MESSAGES_PER_CONVERSATION,
};
