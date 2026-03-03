# Project Memory — Obsidian Claude Agent Plugin

## Quick reference
- Build: `npm run dev` (watch) / `npm run build` (production)
- Entry: `src/main.ts` → esbuild → `main.js` + `src/styles/index.css` → `styles.css`
- Plugin ID: `claude-agent`, desktop-only
- SDK: `@anthropic-ai/claude-agent-sdk` ^0.2.63 — bundled (NOT external)

## Architecture summary
See [architecture.md](architecture.md) for detailed module map and data flow.

Key layers: Agent (`src/agent/`) → Services (`src/services/`) → State (`src/state/`) → UI (`src/ui/`)
Settings: 3-layer merge (UI → user → project → custom) via `SettingsResolver`

## Current state (Phase 0 complete)
- Code decoupled: agent-service split into 5 modules, main.ts slim, CSS modularized
- ROADMAP.md tracks all phases; Phase 0 done, Phase 1 done, Phase 2+ pending
- Settings: 14 section files, Zod-validated config schema, settings migrator

## Patterns to follow
- Settings sections: `class Section*` with `display()` in `src/settings/section-*.ts`
- UI components: plain classes composed in ChatView, no framework
- EventBus typed pub/sub for cross-component communication
- AgentService.sendMessage() is an async generator yielding AgentEvent
- Tool permissions: "allow" | "ask" | "deny" per tool, safe mode vs super mode
- CSS variables: `--ca-*` prefix in `src/styles/variables.css`

## User preferences
- Language: Chinese for conversation, English for code/docs/memory files
- Uses speckit workflow for feature planning
