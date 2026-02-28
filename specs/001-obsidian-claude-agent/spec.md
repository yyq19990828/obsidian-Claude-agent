# Feature Specification: Obsidian Claude Agent Plugin (MVP)

**Feature Branch**: `001-obsidian-claude-agent`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "我需要用@anthropic-ai/claude-agent-sdk 开发一套用于obsidian的agent插件, 这是一个初版, 首先我们要满足基本的UI交互以及把当前TAB页面作为自动上下文附加, 以及可以直接在vault里面写入 修改文档"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chat with AI agent in sidebar (Priority: P1)

As a user, I want to open a chat panel in Obsidian's sidebar where I can type messages and receive AI responses, so that I can interact with an AI assistant without leaving my workspace.

**Why this priority**: The chat UI is the foundational interaction surface. Without it, no other feature can function. This delivers immediate value as a conversational AI assistant within Obsidian.

**Independent Test**: Can be fully tested by opening the sidebar panel, typing a message, and receiving a response. Delivers value as a standalone chat assistant.

**Acceptance Scenarios**:

1. **Given** the plugin is enabled, **When** the user clicks the sidebar icon or triggers the command, **Then** a chat panel opens in the right sidebar with a message input area and a conversation history display.
2. **Given** the chat panel is open, **When** the user types a message and sends it, **Then** the message appears in the conversation history and the AI begins streaming a response.
3. **Given** a conversation is in progress, **When** the AI responds, **Then** the response streams in real-time (token by token) and renders markdown formatting.
4. **Given** the chat panel is open, **When** the user closes and reopens Obsidian, **Then** the chat panel state (open/closed) is restored, but conversation history starts fresh.

---

### User Story 2 - Auto-attach current tab as context (Priority: P2)

As a user, I want the content of my currently active note to be automatically included as context when I chat with the AI, so that the AI understands what I'm working on and can provide relevant assistance.

**Why this priority**: Context-awareness is what differentiates this plugin from a generic chatbot. Users expect the AI to "see" what they're working on. This is the key value proposition for an Obsidian-integrated agent.

**Independent Test**: Can be tested by opening a note, sending a message in the chat, and verifying the AI's response demonstrates awareness of the note content.

**Acceptance Scenarios**:

1. **Given** the user has an active note open, **When** they send a message in the chat panel, **Then** the content of the active note is automatically included as context for the AI.
2. **Given** the user switches to a different note, **When** they send a new message, **Then** the context updates to reflect the newly active note.
3. **Given** no note is currently active (e.g., settings tab is open), **When** the user sends a message, **Then** the AI responds without note context and the conversation proceeds normally.
4. **Given** the active note exceeds the configured max context size, **When** the user sends a message, **Then** the content is truncated to the configured limit and a notification informs the user that the context was truncated.

---

### User Story 3 - AI writes and modifies vault files (Priority: P3)

As a user, I want the AI agent to be able to create new notes and edit existing notes in my vault based on our conversation, so that I can use the AI to help me manage and produce content directly.

**Why this priority**: Direct vault manipulation is the core "agent" capability that makes this more than a chatbot. It enables productivity workflows like generating notes, restructuring content, and batch editing.

**Independent Test**: Can be tested by asking the AI to create a new note or edit an existing one, then verifying the file changes in the vault.

**Acceptance Scenarios**:

1. **Given** a conversation is active, **When** the user asks the AI to create a new note (e.g., "Create a note called 'Meeting Notes' with today's agenda"), **Then** the AI creates the file in the vault with the specified content.
2. **Given** a conversation is active, **When** the user asks the AI to modify an existing note (e.g., "Add a summary section to my current note"), **Then** the AI edits the file and the changes are visible in the editor.
3. **Given** the AI is about to write or modify a file, **When** the operation is executed, **Then** the user can see what changes were made (the AI describes the changes in the chat).
4. **Given** the AI attempts to modify a file, **When** an error occurs (e.g., file is locked or path is invalid), **Then** the AI reports the error gracefully in the chat.

---

### User Story 4 - Dual authentication: API key and OAuth (Priority: P1)

As a user, I want to authenticate via either an Anthropic API key or my Claude Code Max/Pro subscription (OAuth login), so that I can use the AI agent regardless of my subscription type.

**Why this priority**: Authentication is required for any AI interaction. Without it, no other feature works. Supporting both methods ensures the widest user base. Co-prioritized with P1 as a prerequisite.

**Independent Test**: Can be tested by (a) entering an API key in settings and chatting, or (b) clicking OAuth login and chatting after authorization.

**Acceptance Scenarios**:

1. **Given** the plugin is installed, **When** the user opens the plugin settings, **Then** they see two authentication options: an API key input field and an OAuth login button for Claude Code subscribers.
2. **Given** no authentication is configured, **When** the user tries to send a message, **Then** a clear message guides them to configure authentication in settings.
3. **Given** a valid API key is entered, **When** the user sends a message, **Then** the AI responds successfully using the API key.
4. **Given** the user clicks the OAuth login button, **When** the OAuth flow completes successfully, **Then** the plugin stores the session and the user can chat without an API key.
5. **Given** an invalid API key or expired OAuth session, **When** the user sends a message, **Then** a clear error message indicates the authentication failed and how to fix it.
6. **Given** both API key and OAuth are configured, **When** the user sends a message, **Then** the system uses the most recently configured authentication method.

---

### Edge Cases

- What happens when the user sends a message while the AI is still responding to a previous message? New messages are queued and automatically sent after the current response completes. The input remains enabled and a queue indicator is shown.
- How does the system handle network disconnection during a streaming response? The partial response should be preserved and an error indicator shown.
- What happens when the AI tries to write to a file path that doesn't exist (nested folders)? The system should create intermediate folders automatically.
- What happens when the vault has thousands of files and the user asks the AI to find/modify one? The scope of vault operations is limited to explicit file paths in this MVP; no vault-wide search.
- What happens when the user sends an empty message? The system should ignore it or show a brief validation message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a sidebar panel view for chat interaction, accessible via a ribbon icon and a command palette command.
- **FR-002**: System MUST stream AI responses in real-time, displaying tokens as they arrive.
- **FR-003**: System MUST render AI responses as formatted markdown (headings, lists, code blocks, bold, italic).
- **FR-004**: System MUST automatically capture the content of the currently active note and include it as context when sending messages to the AI.
- **FR-005**: System MUST update the context when the user switches between notes.
- **FR-006**: System MUST provide vault file tools to the AI agent: read file, create file, and modify file. File deletion is explicitly out of scope for this MVP.
- **FR-007**: System MUST support two authentication methods: Anthropic API key entry and OAuth login for Claude Code Max/Pro subscribers.
- **FR-008**: System MUST store authentication credentials securely using Obsidian's built-in data persistence.
- **FR-009**: System MUST display clear error messages when authentication fails, network errors occur, or file operations fail.
- **FR-010**: System MUST allow users to clear the current conversation and start fresh.
- **FR-011**: System MUST show a loading/thinking indicator while waiting for the AI to respond.
- **FR-012**: System MUST restrict all file operations to within the vault boundary (no access to files outside the vault).
- **FR-013**: System MUST report file changes made by the AI in the chat conversation so the user is aware of what was modified.
- **FR-014**: System MUST provide a settings toggle for file operation confirmation mode: "confirm before execute" (default) or "auto-execute". When confirmation is enabled, the AI presents proposed changes and waits for user approval before writing.
- **FR-015**: System MUST provide a configurable maximum context size setting (in characters) for active note content. When the active note exceeds the limit, content is truncated and the user is notified in the chat.

### Key Entities

- **Conversation**: A sequence of user messages and AI responses within a single chat session. Does not persist across plugin reloads in this MVP.
- **Message**: A single unit of communication, either from the user or from the AI. Contains text content and a sender role.
- **Note Context**: The content of the currently active note, automatically captured and provided to the AI as background information.
- **Vault Tool**: A capability exposed to the AI agent that allows it to perform file operations (read, create, modify) within the vault.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can send a message and receive a streaming AI response within 3 seconds of sending (excluding network latency).
- **SC-002**: The active note content is correctly attached as context in 100% of messages sent while a note is active.
- **SC-003**: AI-initiated file operations (create, modify) succeed and reflect in the vault within 2 seconds.
- **SC-004**: Users can set up authentication and start chatting in under 2 minutes from first plugin enable.
- **SC-005**: All file operations by the AI are confined to the vault; no file outside the vault is accessible.
- **SC-006**: Error states (no API key, invalid key, network failure, file error) display user-friendly messages in 100% of cases.

## Clarifications

### Session 2026-02-28

- Q: Authentication method — API key only or also OAuth? → A: Both. Support API key and Claude Code Max/Pro subscriber OAuth login.
- Q: AI file operations require user confirmation? → A: Configurable. Settings toggle lets users choose confirm-before-execute or auto-execute.
- Q: Behavior when user sends message during AI response? → A: Queue. New messages are queued and sent automatically after current response completes.
- Q: How to handle very large active notes as context? → A: User-configurable max context size in settings. When exceeded, content is truncated and user is notified.
- Q: Should AI vault tools support file deletion? → A: No. MVP only supports read, create, and modify. No delete capability.

## Assumptions

- Users have an active Anthropic API key or Claude Code Max/Pro subscription.
- The plugin is desktop-only (`isDesktopOnly: true`) since the Claude Agent SDK requires Node.js.
- Conversation history does not persist across sessions in this MVP. Future versions may add persistence.
- The AI agent model used is Claude (latest available via the Agent SDK).
- File operations are limited to explicit paths; vault-wide search or bulk operations are out of scope for this MVP.
- The chat panel uses Obsidian's native ItemView for the sidebar, following Obsidian plugin conventions.
