# Tasks: Obsidian Claude Agent Plugin (MVP)

**Input**: Design documents from `/specs/001-obsidian-claude-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not requested — no automated test tasks included. Manual testing via Obsidian vault.

**Organization**: Tasks grouped by user story. US4 (Auth) is merged into Foundational since all stories depend on authentication.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, configure build tooling, create project directory structure

- [X] T001 Install `@anthropic-ai/claude-agent-sdk` and `zod` as dependencies via `npm install @anthropic-ai/claude-agent-sdk zod`
- [X] T002 Update `esbuild.config.mjs` to ensure SDK is bundled (NOT in external list) and Node builtins remain external for Electron runtime
- [X] T003 Update `manifest.json`: set `isDesktopOnly` to `true`, update `id` to `claude-agent`, update `name` to `Claude Agent`, update `description`
- [X] T004 [P] Create directory structure: `src/agent/` and `src/ui/` directories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, settings with dual auth, and minimal plugin entry point. MUST complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define shared TypeScript interfaces (Message, Conversation, ToolCall, NoteContext, Settings) in `src/types.ts` per data-model.md entities
- [X] T006 Rewrite `src/settings.ts`: implement `ClaudeAgentSettings` interface with all fields from data-model.md (apiKey, authMethod, maxContextSize, confirmFileOperations, model), `DEFAULT_SETTINGS`, and `ClaudeAgentSettingTab` extending `PluginSettingTab` with controls per contracts/chat-view.md settings table (API key input with password mask, auth method dropdown, max context size input, confirm toggle, model dropdown)
- [X] T007 Rewrite `src/main.ts` as minimal plugin entry point: import settings, register ribbon icon (`bot`), register commands (`open-chat-panel`, `clear-conversation`), register chat view, load/save settings. Remove all sample code (SampleModal, sample commands, click listener, interval)

**Checkpoint**: Plugin loads in Obsidian with settings tab showing auth configuration. No chat functionality yet.

---

## Phase 3: User Story 1 + User Story 4 - Chat with AI agent in sidebar + Dual authentication (Priority: P1) 🎯 MVP

**Goal**: Users can open a sidebar chat panel, authenticate via API key or Claude Code subscription, send messages, and receive streaming AI responses with markdown rendering.

**Independent Test**: Enable plugin → configure API key in settings → open chat panel via ribbon icon → type a message → see streaming response with formatted markdown.

### Implementation for User Story 1 + 4

- [X] T008 [US1] Implement `ChatView` class extending `ItemView` in `src/ui/chat-view.ts`: register view type `claude-agent-chat-view`, build chat layout (header with clear button, message container with scroll, context indicator bar, input area with textarea and send button), handle send on Enter key and button click, expose methods `addUserMessage()`, `startAssistantMessage()`, `appendAssistantToken()`, `finishAssistantMessage()`, `showError()`, `showLoading()`, `clearConversation()`
- [X] T009 [P] [US1] Implement `MessageRenderer` in `src/ui/message-renderer.ts`: create user message bubbles and assistant message bubbles as DOM elements, render assistant content as markdown using `MarkdownRenderer.render()` from Obsidian API, handle streaming by appending text to a buffer and re-rendering markdown on each token batch (debounced), style message bubbles with CSS classes
- [X] T010 [US1] Implement `AgentService` class in `src/agent/agent-service.ts`: constructor takes `App` and `ClaudeAgentSettings`, method `sendMessage(userText: string, noteContext?: NoteContext): AsyncGenerator<AgentEvent>` that calls SDK `query()` with `includePartialMessages: true`, async generator for prompt input (required by MCP tools), handles `stream_event` (text_delta), `assistant` (complete message), `result` (done/error) message types, captures `sessionId` from `system.init` for multi-turn `resume`, uses `AbortController` for cancellation on plugin unload, passes API key via `options.env.ANTHROPIC_API_KEY` when authMethod is `api_key`
- [X] T011 [US1] Wire `ChatView` to `AgentService` in `src/main.ts`: on send message from ChatView → call AgentService.sendMessage() → iterate async generator → route events to ChatView methods (appendAssistantToken for stream_event, finishAssistantMessage for result), handle errors with ChatView.showError(), implement message queue (store pending messages in array, auto-send next after response completes), show "no auth configured" message when no API key and authMethod is api_key
- [X] T012 [US1] Add chat panel styles in `styles.css`: message container layout (flex column, scroll), user bubble (right-aligned, accent background), assistant bubble (left-aligned, neutral background), input area (fixed bottom, textarea with send button), loading indicator (animated dots), context indicator bar, error message styling, queue indicator
- [X] T013 [US1] Implement conversation clear: wire clear button in ChatView header and `clear-conversation` command to reset Conversation state (clear messages array, reset sessionId, clear DOM), show welcome message after clear

**Checkpoint**: Plugin fully functional as a chat assistant. Users can configure API key, open sidebar, chat with Claude, see streaming markdown responses. This is the MVP.

---

## Phase 4: User Story 2 - Auto-attach current tab as context (Priority: P2)

**Goal**: Active note content is automatically captured and sent as context with each user message. The AI understands what the user is currently working on.

**Independent Test**: Open a note with distinctive content → send a message asking about the note → verify AI's response references the note content. Switch to another note → send another message → verify context updated.

### Implementation for User Story 2

- [X] T014 [US2] Implement `ContextService` in `src/agent/context.ts`: method `captureActiveNoteContext(app: App, maxSize: number): NoteContext | null` that reads `app.workspace.getActiveFile()`, reads content via `app.vault.read()`, truncates to `maxSize` characters if needed (set `truncated: true`), returns `null` if no active markdown file
- [X] T015 [US2] Integrate context into message flow in `src/agent/agent-service.ts`: before calling `query()`, call `ContextService.captureActiveNoteContext()`, prepend context to user message in format `[Current note: {path}]\n{content}\n\n---\n\n{user message}`, if context is truncated add note `[Note: content truncated to {maxSize} characters]`
- [X] T016 [US2] Update `ChatView` context indicator in `src/ui/chat-view.ts`: register workspace event `active-leaf-change` via `this.registerEvent()` to update context indicator bar showing current note path (or "No active note"), show truncation warning icon when content exceeds maxContextSize

**Checkpoint**: Chat messages now include active note context. AI responses demonstrate awareness of the current note.

---

## Phase 5: User Story 3 - AI writes and modifies vault files (Priority: P3)

**Goal**: AI agent can create new notes and modify existing notes in the vault via MCP tools. Users can approve/reject file operations when confirmation mode is enabled.

**Independent Test**: Ask AI to "create a note called test-note.md with hello world content" → verify file appears in vault. Ask AI to "add a new section to test-note.md" → verify file is modified.

### Implementation for User Story 3

- [X] T017 [US3] Implement MCP vault tools in `src/agent/vault-tools.ts`: define `read_note`, `write_note`, `modify_note` tools using `tool()` from SDK with Zod schemas per contracts/mcp-tools.md, create `createVaultMcpServer(app: App)` function that returns `createSdkMcpServer({ name: "obsidian-vault", tools: [...] })`, implement vault-boundary validation (reject paths with `..` or absolute paths), auto-create parent folders via `vault.createFolder()` for write_note
- [X] T018 [US3] Integrate MCP server into `AgentService` in `src/agent/agent-service.ts`: pass vault MCP server in `options.mcpServers`, set `allowedTools: ["mcp__obsidian-vault__*"]`, handle tool_use content blocks in assistant messages to extract tool call info for UI display
- [X] T019 [US3] Implement tool approval UI in `src/ui/tool-approval.ts`: when `confirmFileOperations` is enabled and AI proposes a tool call, render a pending tool call card in the chat (tool name, file path, content preview), show approve/reject buttons, on approve → execute tool and return result to SDK, on reject → return rejection message to SDK, when `confirmFileOperations` is disabled → auto-execute and show result
- [X] T020 [US3] Render tool call results in `src/ui/message-renderer.ts`: add tool call indicator within assistant message bubbles showing tool name, file path, and execution status (pending/executed/rejected), style with distinct visual treatment (bordered card, status icon)
- [X] T021 [US3] Add tool call reporting in chat: after each tool execution, append a system-style message to conversation showing what file was created/modified with the result text from the tool

**Checkpoint**: Full agent capability operational. AI can read, create, and modify vault files with user approval when configured.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, lifecycle cleanup, and edge cases across all user stories

- [X] T022 [P] Implement AbortController cleanup in `src/main.ts` onunload: abort any in-flight SDK query, clean up all registered events and intervals per constitution principle III
- [X] T023 [P] Add comprehensive error handling across agent-service.ts: catch network errors during streaming (preserve partial response, show error in chat), handle invalid API key errors with guidance message pointing to settings, handle SDK initialization failures gracefully
- [X] T024 Verify and fix edge cases: empty message validation in ChatView (ignore empty sends), message queue indicator display when messages are queued during AI response, ensure `styles.css` provides responsive layout for different sidebar widths

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1+US4 (Phase 3)**: Depends on Foundational — this is the MVP
- **US2 (Phase 4)**: Depends on Phase 3 (needs ChatView and AgentService)
- **US3 (Phase 5)**: Depends on Phase 3 (needs AgentService for MCP integration)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1+US4 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **US2 (P2)**: Depends on US1 (needs AgentService.sendMessage to inject context into)
- **US3 (P3)**: Depends on US1 (needs AgentService for MCP server integration). Independent of US2.

### Within Each User Story

- Models/types before services
- Services before UI integration
- Core implementation before polish
- Story complete before moving to next priority

### Parallel Opportunities

- T003 and T004 can run in parallel (Phase 1)
- T009 can run in parallel with T008 (different files, no dependency)
- T022 and T023 can run in parallel (Phase 6)
- US2 (Phase 4) and US3 (Phase 5) could theoretically run in parallel after US1 completes, but sequential is recommended for a single developer

---

## Parallel Example: User Story 1

```bash
# After T008 (ChatView), these can run in parallel:
Task T009: "Implement MessageRenderer in src/ui/message-renderer.ts"
Task T010: "Implement AgentService in src/agent/agent-service.ts"

# Then sequential:
Task T011: "Wire ChatView to AgentService in src/main.ts" (depends on T008, T009, T010)
```

## Parallel Example: User Story 3

```bash
# After T017 (vault tools), these can run in parallel:
Task T018: "Integrate MCP server into AgentService"
Task T019: "Implement tool approval UI"

# Then sequential:
Task T020: "Render tool call results" (depends on T019)
Task T021: "Add tool call reporting" (depends on T018, T020)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 4 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007)
3. Complete Phase 3: US1+US4 (T008-T013)
4. **STOP and VALIDATE**: Test in Obsidian — configure API key, open chat, send message, see streaming response
5. Deploy/demo if ready — this is a fully functional chat assistant

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1+US4 → Test independently → **MVP! Chat works**
3. Add US2 (Context) → Test independently → **AI now understands your notes**
4. Add US3 (Vault tools) → Test independently → **AI can create and edit files**
5. Polish → Error handling, edge cases → **Production ready**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No automated tests in MVP — manual testing in Obsidian vault
- US4 (Auth) is merged into Foundational + US1 since it's a prerequisite, not a standalone feature
