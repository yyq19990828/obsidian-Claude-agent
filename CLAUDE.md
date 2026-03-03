# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md for Obsidian plugin development guide (build, conventions, testing, security).

## Build commands

```bash
npm install          # Install dependencies
npm run dev          # Dev watch mode (esbuild, auto-rebuild JS + CSS)
npm run build        # Production build (tsc type-check + esbuild minified)
npm run lint         # ESLint
```

Manual testing: copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/claude-agent/`, reload Obsidian.

## Project overview

Obsidian desktop plugin that integrates Claude Agent SDK for AI agent conversations in a sidebar chat view. Desktop-only (`isDesktopOnly: true`) because Agent SDK requires Node.js.

- **SDK**: `@anthropic-ai/claude-agent-sdk` (NOT `@anthropic-ai/sdk`) — bundled into main.js, NOT in esbuild `external`
- **Auth**: Dual mode — API key or Claude Code CLI (Max/Pro subscribers, no key needed)
- **Manifest ID**: `claude-agent`

## Architecture

### Data flow

```
User input → MessageProcessor.enqueueOrRun()
  → AgentService.sendMessage() [async generator yielding AgentEvents]
    → SdkOptionsBuilder builds query options
    → SDK query() stream
    → MessageExtractor parses SDK messages
  → ChatView renders incrementally (stream tokens, tool cards, thinking blocks)
  → ConversationStore persists messages (debounced 500ms)
```

### Module map

| Layer | Directory | Key files | Responsibility |
|-------|-----------|-----------|----------------|
| Entry | `src/` | `main.ts` | Plugin lifecycle, wiring services |
| Agent | `src/agent/` | `agent-service.ts` (orchestrator), `sdk-options-builder.ts`, `tool-permission.ts`, `message-extractor.ts`, `executable-resolver.ts`, `vault-tools.ts`, `agent-loader.ts` | SDK communication, tool permissions, MCP vault tools |
| Services | `src/services/` | `message-processor.ts` | Message queue, event dispatch pipeline |
| State | `src/state/` | `conversation-store.ts`, `tab-manager.ts`, `event-bus.ts` | Persistence, multi-tab, typed pub/sub |
| UI | `src/ui/` | `chat-view.ts` (ItemView), `message-renderer.ts`, `components/` | Chat interface, streaming render |
| Settings | `src/settings/` | `settings-tab.ts`, `settings-resolver.ts`, `section-*.ts` (14 sections), `config-file-schema.ts` | Settings UI, 3-layer config merge |
| Types | `src/` | `types.ts`, `constants.ts` | Shared interfaces, defaults |
| Styles | `src/styles/` | `index.css` → `variables.css`, `base/`, `components/`, `features/`, `settings/` | Modular CSS bundled via esbuild |

### Key patterns

- **3-layer settings resolution**: UI settings → user (`~/.claude/settings.json`) → project (`<vault>/.claude/settings.json`) → custom (`<plugin>/.agent/settings.json`). Scalars: last wins. Collections: merge/union. Validated with Zod (`config-file-schema.ts`).
- **Permission system**: Tools have `ToolPermission` = "allow" | "ask" | "deny". Safe mode disables all SDK tools except read-only ones (`PERMISSION_FREE_TOOLS` in constants.ts). Super mode enables per-tool toggles.
- **Multi-tab conversations**: Each tab has independent `ConversationTab` with sessionId for SDK resume. `TabManager` tracks active tab, `ConversationStore` persists via `loadData()`/`saveData()`.
- **EventBus**: Typed pub/sub (`EventMap` in types.ts) decouples components. Events: `tab:*`, `conversation:*`, `agent:*`, `settings:changed`.
- **Async generator streaming**: `AgentService.sendMessage()` yields `AgentEvent` objects consumed by `MessageProcessor`.
- **Vault tools via MCP**: `vault-tools.ts` creates `createSdkMcpServer()` with `write_note`/`edit_note` tools, path-validated and permission-gated.
- **Filesystem agents**: `.md` files with YAML frontmatter loaded from 3 layers by `agent-loader.ts`.

### Build config

esbuild bundles two entry points:
- `src/main.ts` → `main.js` (CJS, ES2018, tree-shaking)
- `src/styles/index.css` → `styles.css`

External: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, all Node builtins. Agent SDK is intentionally **NOT** external — it gets bundled.

## Conventions

- TypeScript strict mode, ES2018 target
- Settings sections follow pattern: `class Section*` with `display()` method
- UI components are plain classes composed in `ChatView`, not framework components
- CSS uses `--ca-*` custom properties in `variables.css`
- Keep `main.ts` minimal (lifecycle + wiring only)
- Use `this.register*` helpers for cleanup on unload
