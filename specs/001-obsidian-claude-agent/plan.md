# Implementation Plan: Obsidian Claude Agent Plugin (MVP)

**Branch**: `001-obsidian-claude-agent` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-obsidian-claude-agent/spec.md`

## Summary

Build an Obsidian sidebar chat plugin powered by the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). The MVP delivers: (1) a sidebar chat panel with real-time streaming responses, (2) automatic active-note context attachment, (3) vault file operations (read/write/modify) via MCP tools, and (4) dual authentication (API key + Claude Code subscription). The SDK's V1 `query()` API with `createSdkMcpServer()` provides the integration surface; Obsidian's `ItemView` hosts the chat UI.

## Technical Context

**Language/Version**: TypeScript (strict mode), ES2018 target
**Primary Dependencies**: `@anthropic-ai/claude-agent-sdk`, `zod`, `obsidian` (external)
**Storage**: Obsidian `saveData()`/`loadData()` for settings; in-memory for conversation
**Testing**: Manual testing in Obsidian vault (no automated test framework in MVP)
**Target Platform**: Obsidian desktop (Electron) — `isDesktopOnly: true`
**Project Type**: Obsidian community plugin (desktop-app plugin)
**Performance Goals**: Streaming response visible within 3s of send; file ops complete within 2s
**Constraints**: Single bundled `main.js` via esbuild; no unbundled runtime deps; vault-only file access
**Scale/Scope**: Single user, single conversation at a time, ~6 source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                       | Status | Notes                                                                |
|---------------------------------|--------|----------------------------------------------------------------------|
| I. Plugin-First Architecture    | PASS   | Single plugin, minimal main.ts, modular src/ structure               |
| II. Privacy & Consent           | PASS   | API key stored locally, network calls require user auth setup, disclosure in settings |
| III. Safe Lifecycle Management  | PASS   | All listeners via `register*` helpers, AbortController for in-flight requests |
| IV. Simplicity & Minimalism    | PASS   | 6 source files, no frameworks, minimal dependencies (SDK + zod)      |
| V. Type Safety & Build Discipline | PASS | Strict TypeScript, esbuild bundling, lint                           |

**Post-Phase 1 re-check**: All principles remain satisfied. The MCP tool design uses Obsidian's Vault API (vault-boundary enforcement). No speculative abstractions introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-obsidian-claude-agent/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: SDK research and decisions
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Setup and architecture guide
├── contracts/
│   ├── mcp-tools.md     # MCP tool contracts (read/write/modify)
│   └── chat-view.md     # Chat UI contract (commands, layout, flows)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main.ts              # Plugin entry point (lifecycle, command registration)
├── settings.ts          # Settings interface, defaults, SettingTab
├── types.ts             # Shared TypeScript interfaces (Message, Conversation, etc.)
├── agent/
│   ├── agent-service.ts # Claude Agent SDK integration (query, streaming, session)
│   ├── vault-tools.ts   # MCP tool definitions (read_note, write_note, modify_note)
│   └── context.ts       # Active note context capture and truncation
└── ui/
    ├── chat-view.ts     # ItemView sidebar panel (chat container)
    ├── message-renderer.ts # Message bubble rendering + markdown
    └── tool-approval.ts # File operation confirmation UI (approve/reject)
```

**Structure Decision**: Single project layout following Obsidian plugin conventions. Source in `src/` with two subdirectories: `agent/` for SDK integration logic and `ui/` for view components. Each file has a single responsibility and stays under ~300 lines per constitution requirement.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
