# Research: Obsidian Claude Agent Plugin (MVP)

**Branch**: `001-obsidian-claude-agent` | **Date**: 2026-02-28

## R-001: Authentication Methods

**Decision**: Support two authentication paths: (1) Manual API key entry, (2) Automatic detection of local Claude Code installation credentials.

**Rationale**: The Claude Agent SDK reads `ANTHROPIC_API_KEY` from environment variables. Additionally, when Claude Code is installed locally with a Max/Pro subscription, the SDK can use those credentials automatically by spawning a Claude Code subprocess. Anthropic's policy prohibits third-party developers from offering claude.ai OAuth login directly, so "OAuth" in the spec should be interpreted as "use existing Claude Code subscription auth" rather than a traditional browser-based OAuth flow.

**Alternatives considered**:
- Browser-based OAuth flow: Rejected. Anthropic explicitly prohibits third-party developers from offering claude.ai login unless pre-approved.
- API key only: Rejected. Would exclude Claude Code Max/Pro subscribers who don't have separate API keys.
- Third-party providers (Bedrock/Vertex): Deferred to future version.

**Implementation notes**:
- API key: user enters key in settings, passed via `options.env.ANTHROPIC_API_KEY`
- Claude Code subscription: SDK auto-detects when Claude Code is installed locally. No explicit OAuth flow needed — the SDK handles this internally.
- Settings UI shows: API key field + status indicator for Claude Code detection

## R-002: Claude Agent SDK Integration Pattern

**Decision**: Use the V1 stable `query()` API with `createSdkMcpServer()` for custom vault tools and `includePartialMessages: true` for token-level streaming.

**Rationale**: V1 is the stable API. V2 (session-based) is marked `unstable_` and may change. For an MVP, stability is more important than API ergonomics. V1's `resume` option supports multi-turn conversations within a session.

**Alternatives considered**:
- V2 unstable session API (`unstable_v2_createSession`): Better ergonomics for multi-turn chat but marked unstable. Deferred.
- Direct Anthropic REST API: Would bypass the Agent SDK's tool execution and subprocess management. Rejected.

**Key API patterns**:
```typescript
// Streaming with token-level output
for await (const message of query({
  prompt: asyncMessageGenerator(),
  options: {
    includePartialMessages: true,
    mcpServers: { "vault": vaultServer },
    allowedTools: ["mcp__vault__*"],
    systemPrompt: "...",
    abortController: controller
  }
})) {
  if (message.type === "stream_event") {
    // token-by-token text
  } else if (message.type === "assistant") {
    // complete assistant message
  } else if (message.type === "result") {
    // conversation turn complete
  }
}
```

## R-003: Vault File Operations via MCP Tools

**Decision**: Implement three MCP tools using `tool()` + `createSdkMcpServer()`: `read_note`, `write_note`, `modify_note`. All operations are restricted to vault paths via Obsidian's `Vault` API.

**Rationale**: The SDK's MCP tool system provides a clean, declarative way to define tools with Zod schemas. Using Obsidian's native `Vault` API ensures all file operations are sandboxed within the vault boundary. No direct `fs` access needed.

**Alternatives considered**:
- Direct file system access via Node.js `fs`: Rejected. Violates vault boundary constraint and Obsidian security policy.
- Obsidian's `FileSystemAdapter`: Provides lower-level access but `Vault` API is sufficient and safer.

**Tool definitions**:
- `read_note(path)`: Read file content via `vault.read(file)`
- `write_note(path, content)`: Create or overwrite via `vault.create()` / `vault.modify()`
- `modify_note(path, content)`: Same as write_note but semantically indicates modification

**Critical constraint**: Custom MCP tools require streaming input mode — the `prompt` parameter must be an `AsyncIterable<SDKUserMessage>`, not a plain string.

## R-004: Chat UI Architecture

**Decision**: Use Obsidian's `ItemView` for the sidebar chat panel with vanilla DOM manipulation for the chat interface.

**Rationale**: Obsidian plugins typically use `ItemView` for sidebar panels. Framework-free DOM manipulation keeps the bundle small and avoids compatibility issues. Obsidian's `MarkdownRenderer.render()` can render markdown content in assistant messages.

**Alternatives considered**:
- React/Preact: Adds bundle size and complexity. Rejected for MVP.
- Svelte: Some Obsidian plugins use it, but adds build complexity. Deferred.
- `Modal`: Too constrained for persistent chat. Rejected.

**Key Obsidian APIs**:
- `ItemView` for sidebar panel registration
- `MarkdownRenderer.render()` for rendering AI markdown responses
- `this.app.workspace.getActiveFile()` for current note context
- `this.app.workspace.on('active-leaf-change', ...)` for context updates

## R-005: Streaming Response Handling

**Decision**: Use `includePartialMessages: true` to get `stream_event` messages containing `content_block_delta` events for real-time text display.

**Rationale**: Token-by-token streaming provides the best user experience. The SDK's `stream_event` type wraps Anthropic's `BetaRawMessageStreamEvent`, which includes `content_block_delta` with `text_delta` for incremental text updates.

**Implementation pattern**:
```typescript
if (message.type === "stream_event") {
  const event = message.event;
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    appendTextToChat(event.delta.text);
  }
}
```

## R-006: Session and Context Management

**Decision**: Use V1 `query()` with `resume` option for multi-turn conversations within a session. Active note content is injected as a system-level context prefix in each user message.

**Rationale**: The `resume` option allows continuing a conversation with full history. Active note content changes between messages, so it's best injected per-message rather than as a fixed system prompt.

**Context injection approach**:
- On each user message, capture `workspace.getActiveFile()` content
- Prepend to user message: `[Current note: {path}]\n{content}\n\n---\n\n{user message}`
- If no active note, send user message as-is
- Truncate content to configurable max size

## R-007: esbuild Configuration for SDK Bundling

**Decision**: Remove `...builtinModules` from esbuild's `external` list and keep the SDK bundled. The SDK must NOT be in `external`.

**Rationale**: Per CLAUDE.md, the SDK must be bundled into `main.js`. However, the SDK uses Node.js built-in modules internally, so some Node built-ins may need to remain external since Electron provides them at runtime.

**Changes needed to esbuild.config.mjs**:
- Do NOT add `@anthropic-ai/claude-agent-sdk` to `external`
- Keep Node built-in modules external (Electron provides them)
- The SDK will be bundled into the final `main.js`

## R-008: Zod Dependency

**Decision**: Install `zod` as a dependency for MCP tool input schema definitions.

**Rationale**: The SDK's `tool()` function requires Zod schemas for input validation. Zod is a lightweight, zero-dependency library that will be bundled into `main.js` by esbuild.

**Alternatives considered**:
- Manual JSON schema: The SDK API requires Zod specifically via `AnyZodRawShape`. No alternative.
