import type { ClaudeAgentSettings, SdkToolToggles, ClaudeSettingSources } from "./types";

export const DEFAULT_SDK_TOOL_TOGGLES: SdkToolToggles = {
	Read: false,
	Write: false,
	Edit: false,
	Bash: false,
	Glob: false,
	Grep: false,
	Skill: false,
	WebFetch: false,
	WebSearch: false,
	NotebookEdit: false,
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
	claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES },

	/* Context */
	maxContextSize: 50_000,

	/* MCP */
	mcpServers: [],

	/* Slash commands */
	slashCommands: [],

	/* Environment */
	envVars: {},

	/* Advanced */
	maxMessagesPerConversation: MAX_MESSAGES_PER_CONVERSATION,
};
