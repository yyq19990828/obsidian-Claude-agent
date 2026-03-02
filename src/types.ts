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

export interface Message {
	role: MessageRole;
	content: string;
	timestamp: number;
	toolCalls?: ToolCall[];
}

export interface Conversation {
	messages: Message[];
	sessionId?: string;
	isLoading: boolean;
	queue: string[];
}

export interface NoteContext {
	path: string;
	content: string;
	truncated: boolean;
}

export type AuthMethod = "api_key" | "claude_code";

export type PermissionMode = "safe" | "super";

export interface SdkToolToggles {
	Read: boolean;
	Write: boolean;
	Edit: boolean;
	Bash: boolean;
	Glob: boolean;
	Grep: boolean;
	Skill: boolean;
	WebFetch: boolean;
	WebSearch: boolean;
	NotebookEdit: boolean;
}

export interface ClaudeSettingSources {
	projectSettings: boolean;
	projectMemory: boolean;
	userSettings: boolean;
	userMemory: boolean;
}

export interface ClaudeAgentSettings {
	apiKey: string;
	authMethod: AuthMethod;
	maxContextSize: number;
	confirmFileOperations: boolean;
	model: string;
	permissionMode: PermissionMode;
	sdkToolToggles: SdkToolToggles;
	claudeSettingSources: ClaudeSettingSources;
}

export type AgentEvent =
	| {
			type: "stream_token";
			token: string;
	  }
	| {
			type: "assistant_complete";
			content: string;
			toolCalls?: ToolCall[];
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
