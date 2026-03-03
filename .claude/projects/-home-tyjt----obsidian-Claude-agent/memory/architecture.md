# Architecture Details

## Data flow
```
User input (ChatView InputArea)
  → MessageProcessor.enqueueOrRun(text, tabId)
    → processMessage(): validates auth, stores user msg
      → AgentService.sendMessage(tabId, text) [async generator]
        → SdkOptionsBuilder.buildSdkOptions() (tools, perms, agents, MCP)
        → SDK query() stream
        → MessageExtractor parses SDK messages
        → yields AgentEvent (stream_token | thinking_token | tool_summary | tool_executed | result)
      → ChatView renders incrementally
      → ConversationStore.addMessage() (debounced 500ms save)
```

## Module dependencies
```
main.ts (lifecycle, wiring)
  ├── AgentService (src/agent/agent-service.ts) — orchestrator
  │   ├── SdkOptionsBuilder — SDK query options assembly
  │   ├── ToolPermission — allowed/disallowed/canUseTool
  │   ├── MessageExtractor — parse SDK message types
  │   ├── ExecutableResolver — find claude CLI path
  │   ├── VaultTools — MCP server for write_note/edit_note
  │   └── AgentLoader — filesystem .md agent definitions
  ├── MessageProcessor (src/services/) — queue + event dispatch
  ├── ConversationStore (src/state/) — persist tabs/messages
  ├── TabManager (src/state/) — active tab lifecycle
  ├── EventBus (src/state/) — typed pub/sub
  ├── ChatView (src/ui/) — Obsidian ItemView
  │   ├── MessageRenderer — DOM rendering, streaming
  │   ├── HeaderBar, TabBar, InputArea, InputToolbar
  │   ├── MessageList, MessageActions, ToolCallCard
  │   ├── ThinkingBlock, StatusPanel, FileContextChips
  │   └── ConversationSidebar
  └── SettingsTab (src/settings/)
      ├── SettingsResolver — 3-layer config merge
      ├── 14 section-*.ts files
      ├── ConfigFileSchema (Zod validation)
      ├── MemoryFileManager — CLAUDE.md management
      └── SettingsMigrator — backwards compat
```

## Permission system
- PermissionMode: "auto_approve" | "confirm" | "plan_only"
- Safe mode: only PERMISSION_FREE_TOOLS + vault tools
- Super mode: per-tool ToolPermission ("allow"/"ask"/"deny")
- Vault tools: separate permissions for write_note, edit_note
- Path validation: no traversal, no absolute paths

## Settings resolution
Priority (last wins for scalars): UI → user layer → project layer → custom layer
- User: `~/.claude/settings.json` + `CLAUDE.md`
- Project: `<vault>/.claude/settings.json` + `CLAUDE.md`
- Custom: `<plugin>/.agent/settings.json` + `CLAUDE.md`
- Agents: `<layer>/agents/*.md` (YAML frontmatter)

## Key types (src/types.ts)
- ClaudeAgentSettings = GeneralSettings & AuthSettings & ModelSettings & SafetySettings & ToolSettings & McpSettings & ConfigLayerSettings & AdvancedSettings
- ConversationTab: id, title, status, messages[], sessionId
- Message: role, content, timestamp, toolCalls?, thinkingBlocks?
- AgentEvent: stream_token | thinking_token | tool_summary | tool_executed | assistant_complete | result
- EventMap: tab:*, conversation:*, agent:*, settings:changed, context:*, status:*, sidebar:*

## Build
- esbuild: 2 contexts (JS + CSS), watch in dev, minify in prod
- Agent SDK bundled (not external) — critical for plugin distribution
- External: obsidian, electron, codemirror, lezer, node builtins
