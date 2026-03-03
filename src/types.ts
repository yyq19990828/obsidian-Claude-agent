/* ── Message & conversation primitives ── */

export type MessageRole = "user" | "assistant" | "system";

export type ToolCallStatus = "pending" | "approved" | "executed" | "rejected";

export interface ToolCall {
	id: string;
	toolName: string;
	input: Record<string, unknown>;
	result?: string;
	status: ToolCallStatus;
	filePath?: string;
}

export interface ThinkingBlock {
	thinking: string;
	collapsed: boolean;
}

export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "tool_call"; toolCallId: string };

export interface UsageStats {
	durationMs: number;
	estimatedInputTokens?: number;
	estimatedOutputTokens?: number;
}

export interface Message {
	role: MessageRole;
	content: string;
	timestamp: number;
	toolCalls?: ToolCall[];
	thinkingBlocks?: ThinkingBlock[];
	contentBlocks?: ContentBlock[];
	usageStats?: UsageStats;
}

/* ── Vault file cache ── */

export interface VaultFileEntry {
	path: string;
	basename: string;
	extension: string;
}

/* ── Fork ── */

export interface ForkSource {
	sourceTabId: string;
	messageIndex: number;
}

/* ── Note context ── */

export interface NoteContext {
	path: string;
	content: string;
	truncated: boolean;
}

/* ── File context chip (drag-attached files) ── */

export interface FileContextChip {
	path: string;
	basename: string;
}

/* ── Auth & settings ── */

export type AuthMethod = "api_key" | "claude_code";

export type PermissionMode = "auto_approve" | "confirm" | "plan_only";

/* ── SDK access control (safe / super mode) ── */

export type ToolPermission = "allow" | "ask" | "deny";

export interface VaultToolPermissions {
	write_note: ToolPermission;
	edit_note: ToolPermission;
}

/**
 * SDK tools that require permission — configurable via allow/ask/deny.
 * Permission-free tools (Read, Glob, Grep, etc.) are always enabled
 * and not listed here.  See PERMISSION_FREE_TOOLS in constants.ts.
 */
export interface SdkToolToggles {
	Write: ToolPermission;
	Edit: ToolPermission;
	Bash: ToolPermission;
	Skill: ToolPermission;
	WebFetch: ToolPermission;
	WebSearch: ToolPermission;
	NotebookEdit: ToolPermission;
}

export interface ClaudeSettingSources {
	projectSettings: boolean;
	projectMemory: boolean;
	userSettings: boolean;
	userMemory: boolean;
	customMemory: boolean;
}

export type ThinkingBudget = "off" | "normal" | "extended";

/* ── Config file layer system ── */

export type ConfigLayer = "ui" | "user" | "project" | "custom";
export type SettingOverrideMap = Partial<Record<keyof ClaudeAgentSettings, ConfigLayer>>;

export interface ResolvedSettings {
	merged: ClaudeAgentSettings;
	overrides: SettingOverrideMap;
}

export interface ConfigLayerToggles {
	userEnabled: boolean;
	projectEnabled: boolean;
	customEnabled: boolean;
}

export interface McpServerConfig {
	id: string;
	name: string;
	command: string;
	args: string[];
	env: Record<string, string>;
	enabled: boolean;
}

export interface SlashCommand {
	id: string;
	name: string;
	prompt: string;
}

export interface SubagentConfig {
	id: string;
	name: string;
	description: string;
	prompt: string;
	model: "sonnet" | "opus" | "haiku" | "inherit";
	tools: string[];
	maxTurns: number;
	enabled: boolean;
}

/* ── Settings sub-groups ── */

export interface GeneralSettings {
	userName: string;
	autoScroll: boolean;
	autoGenerateTitle: boolean;
	showDetailedThinking: boolean;
	showDetailedTools: boolean;
}

export interface AuthSettings {
	apiKey: string;
	authMethod: AuthMethod;
	claudeCliPath: string;
}

export interface ModelSettings {
	model: string;
	thinkingBudget: ThinkingBudget;
}

export interface SafetySettings {
	confirmFileOperations: boolean;
	permissionMode: PermissionMode;
	commandBlacklist: string[];
	allowedPaths: string[];
}

export interface ToolSettings {
	safeMode: boolean;
	sdkToolToggles: SdkToolToggles;
	vaultToolPermissions: VaultToolPermissions;
	claudeSettingSources: ClaudeSettingSources;
}

export interface McpSettings {
	mcpServers: McpServerConfig[];
	slashCommands: SlashCommand[];
	subagents: SubagentConfig[];
	envVars: Record<string, string>;
}

export interface ConfigLayerSettings {
	agentConfigSubdir: string;
	configLayerToggles: ConfigLayerToggles;
}

export interface AdvancedSettings {
	maxContextSize: number;
	maxMessagesPerConversation: number;
}

export type ClaudeAgentSettings =
	GeneralSettings &
	AuthSettings &
	ModelSettings &
	SafetySettings &
	ToolSettings &
	McpSettings &
	ConfigLayerSettings &
	AdvancedSettings;

/* ── Tab & conversation management ── */

export type TabStatus = "idle" | "streaming" | "error";

export interface ConversationTab {
	id: string;
	title: string;
	status: TabStatus;
	messages: Message[];
	sessionId?: string;
	previousSessionIds?: string[];
	forkSource?: ForkSource;
	createdAt: number;
	updatedAt: number;
}

export interface SavedConversationData {
	tabs: ConversationTab[];
	activeTabId: string | null;
}

/* ── Agent events ── */

export type AgentEvent =
	| {
			type: "stream_token";
			token: string;
	  }
	| {
			type: "thinking_token";
			token: string;
	  }
	| {
			type: "assistant_complete";
			content: string;
			toolCalls?: ToolCall[];
			thinkingBlocks?: ThinkingBlock[];
	  }
	| {
			type: "tool_summary";
			summary: string;
	  }
	| {
			type: "tool_executed";
			toolCall: ToolCall;
	  }
	| {
			type: "result";
			success: boolean;
			text?: string;
			error?: string;
	  };

/* ── EventBus event map ── */

export interface EventMap {
	"tab:created": ConversationTab;
	"tab:closed": string;
	"tab:switched": string;
	"tab:status-changed": { tabId: string; status: TabStatus };
	"tab:title-changed": { tabId: string; title: string };
	"conversation:message-added": { tabId: string; message: Message };
	"conversation:cleared": string;
	"conversation:loaded": string;
	"settings:changed": Partial<ClaudeAgentSettings>;
	"agent:stream-token": { tabId: string; token: string };
	"agent:thinking-token": { tabId: string; token: string };
	"agent:complete": { tabId: string; content: string; toolCalls?: ToolCall[]; thinkingBlocks?: ThinkingBlock[] };
	"agent:error": { tabId: string; error: string };
	"agent:loading": { tabId: string; loading: boolean };
	"conversation:rewound": { tabId: string; removedCount: number };
	"conversation:forked": { sourceTabId: string; newTabId: string };
	"context:chips-changed": FileContextChip[];
	"context:file-index-ready": void;
	"session:expired": { tabId: string };
	"session:resumed": { tabId: string };
	"status:tool-active": { toolName: string; status: string };
	"status:bash-output": string;
	"sidebar:toggle": boolean;
}
