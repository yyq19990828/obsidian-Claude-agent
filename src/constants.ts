import type { ClaudeAgentSettings } from "./types";

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
