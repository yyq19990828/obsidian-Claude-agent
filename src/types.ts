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

export interface Message {
	role: MessageRole;
	content: string;
	timestamp: number;
	toolCalls?: ToolCall[];
	thinkingBlocks?: ThinkingBlock[];
}

export interface Conversation {
	messages: Message[];
	sessionId?: string;
	isLoading: boolean;
	queue: string[];
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

export type ThinkingBudget = "off" | "normal" | "extended";

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

export interface ClaudeAgentSettings {
	/* General */
	userName: string;
	autoScroll: boolean;
	autoGenerateTitle: boolean;

	/* Auth */
	apiKey: string;
	authMethod: AuthMethod;
	claudeCliPath: string;

	/* Model */
	model: string;
	thinkingBudget: ThinkingBudget;

	/* Safety */
	confirmFileOperations: boolean;
	permissionMode: PermissionMode;
	commandBlacklist: string[];
	allowedPaths: string[];

	/* Context */
	maxContextSize: number;

	/* MCP */
	mcpServers: McpServerConfig[];

	/* Slash commands */
	slashCommands: SlashCommand[];

	/* Environment */
	envVars: Record<string, string>;

	/* Advanced */
	maxMessagesPerConversation: number;
}

/* ── Tab & conversation management ── */

export type TabStatus = "idle" | "streaming" | "error";

export interface ConversationTab {
	id: string;
	title: string;
	status: TabStatus;
	messages: Message[];
	sessionId?: string;
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
	"context:chips-changed": FileContextChip[];
	"status:tool-active": { toolName: string; status: string };
	"status:bash-output": string;
	"sidebar:toggle": boolean;
}
