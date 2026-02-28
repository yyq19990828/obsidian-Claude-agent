---
name: obsidian-agent-dev
description: Develop Obsidian plugin features with Claude Agent SDK integration
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Obsidian Claude Agent Plugin Development

## SDK Choice

Use `@anthropic-ai/claude-agent-sdk` (Agent SDK), NOT `@anthropic-ai/sdk` (API SDK).

- Agent SDK supports Claude Code Max/Pro subscribers — no API key needed
- Also supports API key authentication for pay-per-use users
- Provides built-in tools (Read, Write, Bash, Grep, WebSearch, etc.)
- Custom vault tools via MCP (`tool()` + `createSdkMcpServer`)
- `isDesktopOnly` MUST be `true` (Agent SDK requires Node.js)

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## esbuild Bundling

- `@anthropic-ai/claude-agent-sdk` must be bundled into `main.js` — do NOT add to `external`
- Node.js built-in modules are already in `external` via `builtinModules`
- Output format: CJS (`format: "cjs"`), target ES2018
- If bundling fails due to Node deps, check esbuild `platform` and `external` config

## Obsidian Plugin Lifecycle

- `onload()`: register commands, settings, events — keep lightweight
- `onunload()`: cleanup happens automatically for `this.register*` helpers
- Always use `this.registerEvent()`, `this.registerDomEvent()`, `this.registerInterval()`
- Settings persist via `this.loadData()` / `this.saveData()` (plain JSON, NOT encrypted)
- Cancel in-flight agent queries on `onunload()`

## Agent SDK Integration Patterns

### Basic Query (driving custom UI)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: userInput,
  options: {
    cwd: vaultPath,
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 20,
    systemPrompt: "You are an Obsidian vault assistant...",
  },
})) {
  if ("result" in message) {
    // Render result in Obsidian ItemView via MarkdownRenderer
  }
}
```

### Custom Vault Tools via MCP

Use `tool()` + `createSdkMcpServer` to wrap Obsidian vault API as MCP tools,
ensuring Obsidian is aware of file changes (events, sync, etc.):

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const searchNotes = tool(
  "search_notes",
  "Search notes in the Obsidian vault by content",
  { query: z.string().describe("Search query") },
  async ({ query: q }) => {
    const files = app.vault.getMarkdownFiles();
    // ... search via vault API
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

const createNote = tool(
  "create_note",
  "Create a new note in the vault",
  {
    path: z.string().describe("Note path relative to vault root"),
    content: z.string().describe("Markdown content"),
  },
  async ({ path, content }) => {
    await app.vault.create(path, content);
    return { content: [{ type: "text", text: `Created ${path}` }] };
  }
);

const vaultServer = createSdkMcpServer({
  name: "obsidian-vault",
  tools: [searchNotes, createNote],
});

for await (const message of query({
  prompt: userInput,
  options: {
    mcpServers: { vault: vaultServer },
    allowedTools: ["Read", "Glob", "Grep"],
  },
})) {
  if ("result" in message) { /* render */ }
}
```

### Session Resumption (multi-turn chat)

```typescript
let sessionId: string | undefined;

// First query: capture session ID
for await (const message of query({
  prompt: firstMessage,
  options: { allowedTools: ["Read", "Glob"] },
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume with full context
for await (const message of query({
  prompt: followUpMessage,
  options: { resume: sessionId },
})) {
  if ("result" in message) { /* render */ }
}
```

### Permission Modes

- `"default"` — prompt user for dangerous operations (recommended for general use)
- `"plan"` — planning only, no file edits
- `"acceptEdits"` — auto-accept file changes
- `"dontAsk"` — no prompts (for automated pipelines)

### Key Options

| Option | Type | Purpose |
|--------|------|---------|
| `cwd` | string | Working directory (set to vault path) |
| `allowedTools` | string[] | Restrict available tools |
| `maxTurns` | number | Prevent runaway agent loops |
| `maxBudgetUsd` | number | Cost cap for the query |
| `systemPrompt` | string | Customize agent behavior |
| `mcpServers` | object | Custom MCP tools (vault operations) |
| `hooks` | object | Pre/Post tool use callbacks |
| `permissionMode` | string | Control permission prompts |
| `model` | string | Model ID (default from CLI config) |

## Security Requirements

- Agent SDK uses Claude Code auth — no API key management needed in plugin
- Disclose network usage in README and settings tab
- Require explicit user opt-in before sending vault content to Anthropic
- Do not send vault content without direct user-initiated action
- Built-in tools (Read/Write/Bash) operate on filesystem directly —
  use custom MCP tools for vault-aware operations when Obsidian sync matters
- Consider restricting `allowedTools` to prevent unintended Bash execution

## UI Patterns

- Use `ItemView` for sidebar chat panels
- Use `Modal` for quick interactions
- Use `MarkdownRenderer.render()` to display AI responses (prevents XSS)
- Add ribbon icon for quick access
- Support command palette integration via `this.addCommand()`
- Surface errors to user via `new Notice()`
