# Implementation Plan: Dual Permission Mode

**Branch**: `002-dual-permission-mode` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-dual-permission-mode/spec.md`

## Summary

Add a dual permission mode system to the Obsidian Claude Agent plugin: **safe mode** (default, vault-only MCP tools) and **super mode** (SDK built-in tools + `.claude/` ecosystem integration). Requires a tabbed settings UI with collapsible tool sections, individual tool toggles, per-level `.claude/` configuration, and a clickable mode indicator in the chat panel.

## Technical Context

**Language/Version**: TypeScript (strict mode), ES2018 target
**Primary Dependencies**: `obsidian` (external), `@anthropic-ai/claude-agent-sdk`, `zod`
**Storage**: Obsidian `saveData()`/`loadData()` for settings; in-memory for conversation state
**Testing**: Manual testing via Obsidian vault plugin reload
**Target Platform**: Obsidian desktop (Electron) — `isDesktopOnly: true`
**Project Type**: Obsidian community plugin (desktop app extension)
**Performance Goals**: Mode switch < 3 seconds; no perceptible UI lag on settings tab
**Constraints**: esbuild CJS bundle; all deps bundled into `main.js`; no files outside vault in safe mode
**Scale/Scope**: Single-user desktop plugin; ~10 source files affected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Plugin-First Architecture | PASS | Single plugin, `main.ts` stays minimal lifecycle only. Settings and UI split into modules. |
| II. Privacy & Consent | PASS | Super mode requires explicit confirmation dialog (FR-005). Safe mode is default. Network requests only via Claude Agent SDK with user-initiated actions. |
| III. Safe Lifecycle Management | PASS | Mode change resets session (FR-008). `registerDomEvent`/`registerEvent` used for all UI listeners. |
| IV. Simplicity & Minimalism | PASS | Two modes with clear boundaries. No speculative features. Collapsible panels reduce visual complexity. |
| V. Type Safety & Build Discipline | PASS | All new types added to `types.ts`. Settings interface extended with typed fields. |

**Constitution violation regarding Principle I**: "The plugin MUST NOT access files outside the Obsidian vault" — **Super mode explicitly grants this capability**. This is justified because:
- Super mode is opt-in with explicit user confirmation (FR-005)
- Safe mode (default) fully complies with vault-only access
- The feature's entire purpose is to unlock beyond-vault capabilities for power users
- Obsidian Developer Policies allow this with disclosure and consent

## Project Structure

### Documentation (this feature)

```text
specs/002-dual-permission-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main.ts                    # Plugin entry — lifecycle only (MODIFY: pass mode to ChatView)
├── types.ts                   # Interfaces and types (MODIFY: extend ClaudeAgentSettings, add PermissionMode)
├── settings.ts                # Settings tab (REWRITE: tabbed layout with General + Tools tabs)
├── agent/
│   ├── agent-service.ts       # SDK query orchestration (MODIFY: build options based on permission mode)
│   ├── context.ts             # Active note context capture (NO CHANGE)
│   └── vault-tools.ts         # Vault MCP tools (NO CHANGE)
└── ui/
    ├── chat-view.ts           # Chat panel (MODIFY: add mode indicator)
    ├── message-renderer.ts    # Message rendering (NO CHANGE)
    └── tool-approval.ts       # Tool approval modal (NO CHANGE)
```

**Structure Decision**: Existing single-project structure is sufficient. Changes are primarily in `settings.ts` (full rewrite for tabbed UI) and `agent-service.ts` (conditional options based on mode). No new directories needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Vault boundary bypass (super mode) | Core feature requirement — users need beyond-vault access for Claude Code ecosystem | Vault-only mode already exists as safe mode; super mode is the explicit opt-in extension |
