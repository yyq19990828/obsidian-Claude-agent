# Data Model: Obsidian Claude Agent Plugin (MVP)

**Branch**: `001-obsidian-claude-agent` | **Date**: 2026-02-28

## Entities

### Settings

Plugin-level configuration persisted via Obsidian's `saveData()`/`loadData()`.

| Field                  | Type     | Default       | Description                                       |
|------------------------|----------|---------------|---------------------------------------------------|
| apiKey                 | string   | `""`          | Anthropic API key (empty if using Claude Code)    |
| authMethod             | enum     | `"api_key"`   | `"api_key"` or `"claude_code"`                    |
| maxContextSize         | number   | `50000`       | Max characters of active note to include as context |
| confirmFileOperations  | boolean  | `true`        | Require user confirmation before AI file writes   |
| model                  | string   | `"claude-sonnet-4-6"` | Claude model to use                      |

### Conversation

In-memory only (not persisted in MVP). Represents a single chat session.

| Field      | Type        | Description                                         |
|------------|-------------|-----------------------------------------------------|
| messages   | Message[]   | Ordered list of messages in this conversation        |
| sessionId  | string?     | SDK session ID for multi-turn resume (set after init)|
| isLoading  | boolean     | Whether AI is currently generating a response        |
| queue      | string[]    | Queued user messages waiting to be sent              |

### Message

A single chat message (user or assistant).

| Field     | Type     | Description                                              |
|-----------|----------|----------------------------------------------------------|
| role      | enum     | `"user"` or `"assistant"`                                |
| content   | string   | Message text content (markdown for assistant)            |
| timestamp | number   | Unix timestamp (ms) of when message was created          |
| toolCalls | ToolCall[]? | Tool calls made by assistant in this message (optional)|

### ToolCall

Record of an AI-initiated tool operation.

| Field     | Type     | Description                                    |
|-----------|----------|------------------------------------------------|
| toolName  | string   | MCP tool name (e.g., `read_note`, `write_note`)|
| input     | object   | Tool input arguments                           |
| result    | string   | Tool execution result                          |
| status    | enum     | `"pending"` / `"approved"` / `"executed"` / `"rejected"` |

### NoteContext

Snapshot of the active note content at message-send time.

| Field     | Type     | Description                                    |
|-----------|----------|------------------------------------------------|
| path      | string   | Vault-relative file path                       |
| content   | string   | Note content (potentially truncated)           |
| truncated | boolean  | Whether content was truncated to max size      |

## State Transitions

### Conversation Lifecycle

```
[Empty] → user sends message → [Active]
[Active] → AI streaming → [Loading]
[Loading] → response complete → [Active]
[Loading] → error → [Active] (with error message)
[Active] → user clears → [Empty]
[Active] → plugin unload → [Destroyed]
```

### Tool Call Lifecycle (when confirmFileOperations = true)

```
[AI proposes tool] → [Pending]
[Pending] → user approves → [Approved] → execute → [Executed]
[Pending] → user rejects → [Rejected]
```

### Tool Call Lifecycle (when confirmFileOperations = false)

```
[AI proposes tool] → auto-execute → [Executed]
```

## Relationships

```
Settings (1) ←→ (1) Plugin
Plugin (1) ←→ (1) Conversation (in-memory)
Conversation (1) ←→ (N) Message
Message (1) ←→ (0..N) ToolCall
Message (1) ←→ (0..1) NoteContext (user messages only)
```
