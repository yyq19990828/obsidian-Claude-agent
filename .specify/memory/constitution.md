<!--
  Sync Impact Report
  ===================
  Version change: N/A (initial) → 1.0.0
  Added principles:
    - I. Plugin-First Architecture
    - II. Privacy & Consent
    - III. Safe Lifecycle Management
    - IV. Simplicity & Minimalism
    - V. Type Safety & Build Discipline
  Added sections:
    - Technology Constraints
    - Development Workflow
  Templates requiring updates:
    - .specify/templates/plan-template.md        ✅ no update needed (generic)
    - .specify/templates/spec-template.md         ✅ no update needed (generic)
    - .specify/templates/tasks-template.md        ✅ no update needed (generic)
  Follow-up TODOs: none
-->

# Obsidian Claude Agent Plugin Constitution

## Core Principles

### I. Plugin-First Architecture

All functionality MUST be delivered as a single Obsidian community plugin.

- The plugin entry point (`src/main.ts`) MUST remain minimal: lifecycle
  management only (onload, onunload, command registration).
- Feature logic MUST be delegated to separate modules under `src/`.
- Every file MUST have a single, well-defined responsibility. Files
  exceeding ~300 lines MUST be split into smaller modules.
- All external dependencies MUST be bundled into `main.js` via esbuild.
  No unbundled runtime dependencies are permitted.
- The plugin MUST NOT access files outside the Obsidian vault.

### II. Privacy & Consent

Network requests to external services (Anthropic API) are permitted ONLY
with explicit, informed user consent.

- The plugin MUST clearly disclose that vault content may be sent to the
  Anthropic API when the user invokes agent features.
- API keys MUST be stored locally via `saveData()` and transmitted ONLY
  to the Anthropic API endpoint. No other destination is permitted.
- The plugin MUST NOT collect telemetry, analytics, or usage data unless
  the user explicitly opts in via a documented setting.
- The plugin MUST NOT transmit vault filenames, metadata, or content
  without a direct, user-initiated action triggering the transmission.
- All external service usage MUST be documented in README.md and in the
  plugin settings tab.

### III. Safe Lifecycle Management

The plugin MUST clean up all resources on unload without leaking
listeners, intervals, or DOM mutations.

- All DOM event listeners MUST use `this.registerDomEvent()`.
- All app/workspace event listeners MUST use `this.registerEvent()`.
- All intervals MUST use `this.registerInterval()`.
- In-flight API requests MUST be aborted via AbortController on unload.
- The plugin MUST be safe to enable/disable/reload repeatedly without
  side effects or memory leaks.

### IV. Simplicity & Minimalism

Start with the minimum viable feature set. Avoid speculative complexity.

- YAGNI: do not implement features, abstractions, or configuration
  options until they are concretely needed.
- Prefer direct, readable code over clever abstractions. Three similar
  lines are preferable to a premature helper function.
- Dependencies MUST be kept minimal. Prefer browser-compatible packages
  and avoid large libraries when a small utility suffices.
- Error handling MUST be present at system boundaries (API calls, user
  input) but MUST NOT be added speculatively for internal code paths.

### V. Type Safety & Build Discipline

TypeScript strict mode is the baseline. Code MUST compile cleanly before
any commit or test.

- `tsconfig.json` MUST enforce `strictNullChecks`, `noImplicitAny`,
  `noImplicitReturns`, and `noImplicitThis`.
- `npm run build` (tsc --noEmit + esbuild) MUST succeed with zero
  errors before code is considered complete.
- ESLint with `eslint-plugin-obsidianmd` MUST pass without errors.
- Prefer `async/await` over promise chains. All async errors MUST be
  caught and surfaced to the user via `Notice` or equivalent UI.

## Technology Constraints

- **Language**: TypeScript (strict mode)
- **Runtime**: Obsidian desktop (Electron) and mobile (Capacitor)
- **Bundler**: esbuild (CJS format, ES2018 target)
- **Package manager**: npm (not yarn, not pnpm)
- **External API**: Anthropic Claude API via `@anthropic-ai/sdk` or
  direct REST calls
- **Obsidian API**: `obsidian` package (type definitions only, provided
  by the host at runtime — listed in esbuild externals)
- **`isDesktopOnly`**: set to `true` if Node.js APIs are required by the
  SDK; otherwise keep `false` for mobile compatibility
- **Build artifacts**: `main.js`, `manifest.json`, `styles.css` at
  project root — never committed to version control

## Development Workflow

1. **Install**: `npm install`
2. **Develop**: `npm run dev` (esbuild watch mode)
3. **Lint**: `npm run lint` (ESLint with obsidianmd plugin)
4. **Build**: `npm run build` (tsc check + esbuild production)
5. **Test**: copy `main.js`, `manifest.json`, `styles.css` to
   `<Vault>/.obsidian/plugins/<plugin-id>/`, reload Obsidian, enable
   plugin in **Settings → Community plugins**
6. **Commit**: only after build succeeds and manual testing passes

## Governance

This constitution is the authoritative source of project principles.
All code changes, reviews, and design decisions MUST comply with these
principles.

- **Amendments**: any principle change requires a documented rationale,
  version bump, and review of dependent templates.
- **Versioning**: MAJOR for principle removal/redefinition, MINOR for
  new principles or material expansion, PATCH for wording clarifications.
- **Compliance**: every feature spec and implementation plan MUST include
  a Constitution Check section verifying alignment with these principles.
- **Guidance**: see `CLAUDE.md` and `AGENTS.md` for runtime development
  guidance.

**Version**: 1.0.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
