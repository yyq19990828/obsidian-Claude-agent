# Research: Dual Permission Mode

**Date**: 2026-02-28 | **Branch**: `002-dual-permission-mode`

## R1: SDK `allowedTools` — Available Built-in Tool Names

**Decision**: The following SDK built-in tools will be exposed as individual toggles in super mode:
- `Read` — Read files from filesystem
- `Write` — Create/overwrite files
- `Edit` — Edit files with search/replace
- `Bash` — Execute terminal commands
- `Glob` — Find files by pattern
- `Grep` — Search file contents
- `Skill` — Invoke Claude Code skills
- `WebFetch` — Fetch web content
- `WebSearch` — Search the web
- `NotebookEdit` — Edit Jupyter notebooks

**Rationale**: These are the standard Claude Code built-in tools documented in the SDK. The `allowedTools` array accepts these exact string names. MCP tools use the `mcp__<server>__<tool>` pattern and are handled separately.

**Alternatives considered**: Exposing tools by category grouping — rejected per clarification (user chose individual toggles).

## R2: SDK `settingSources` Configuration

**Decision**: Map the two UI toggles to SDK `settingSources` array:
- "Project" toggle ON → add `"project"` and `"local"` to `settingSources`
- "User" toggle ON → add `"user"` to `settingSources`
- Both OFF → `settingSources` omitted (SDK default: no filesystem settings loaded)

**Rationale**: SDK v0.1.0+ requires explicit `settingSources` to load any `.claude/` configuration. The `"local"` source is the gitignored override for project settings and logically belongs with the project toggle. Precedence: local > project > user (handled by SDK).

**Alternatives considered**: Three separate toggles (user/project/local) — rejected per clarification (local merged into project).

## R3: Memory Files Integration

**Decision**: Memory files are controlled by separate toggles within each `.claude/` configuration section (Project / User). The SDK loads memory files as part of the auto-memory system when the corresponding `settingSources` are enabled. The memory toggle controls whether memory-specific paths are accessible.

**Rationale**: The auto-memory directory (`.claude/memory/` or `~/.claude/memory/`) is read/written by the SDK when `settingSources` includes the corresponding level. A separate toggle gives users control over whether the agent can persist memories across sessions.

**Alternatives considered**: Bundling memory with the settings source toggle — rejected because memory write is a distinct privacy concern.

## R4: Obsidian Tabbed Settings UI Pattern

**Decision**: Use Obsidian's native DOM API (`createDiv`, `createEl`) to build a custom tabbed settings interface within `PluginSettingTab.display()`. Tabs are rendered as clickable header buttons. Each tab's content is in a container div that shows/hides based on active tab.

**Rationale**: Obsidian does not provide a built-in tabbed settings component. The community pattern (used by plugins like Copilot, Templater) is to create tabs manually using the standard `Setting` API within dynamically shown/hidden container divs.

**Alternatives considered**: Using a third-party UI library — rejected per constitution (minimize dependencies).

## R5: Collapsible Panel Pattern

**Decision**: Implement collapsible sections using Obsidian's `<details>/<summary>` HTML elements or custom div with click-to-toggle class. Each section header shows section name and a chevron indicator. Content is hidden by default.

**Rationale**: Native `<details>` element provides accessible expand/collapse without JavaScript. Custom implementation via CSS class toggling is the alternative if finer styling control is needed.

**Alternatives considered**: Obsidian's built-in `Setting.setHeading()` — insufficient for collapsible behavior.

## R6: Apple-Style Toggle Switch

**Decision**: Use Obsidian's built-in `Toggle` component from the `Setting` API with custom CSS for Apple-style appearance (rounded track, sliding thumb, smooth transition). The `Setting.addToggle()` API provides the base toggle behavior.

**Rationale**: Obsidian's toggle already works functionally. Custom CSS in `styles.css` can style it to match iOS toggle aesthetics (border-radius, transition, colors).

**Alternatives considered**: Custom HTML element — unnecessary since Obsidian's toggle is sufficient with styling.

## R7: Session Reset on Mode Change

**Decision**: When permission mode changes, call `AgentService.resetSession()` to clear the `sessionId`. The next `sendMessage()` call will start a fresh session with the new options.

**Rationale**: The SDK's `resume` option continues an existing session with its original configuration. Changing `allowedTools` or `settingSources` requires a new session to take effect.

**Alternatives considered**: Hot-swapping tools mid-session — not supported by the SDK.

## R8: Confirmation Dialog Pattern

**Decision**: Use Obsidian's `Modal` class to create a confirmation dialog when switching to super mode. The modal displays a list of capabilities being unlocked and requires explicit "Enable" / "Cancel" action.

**Rationale**: Obsidian provides `Modal` as the standard way to show dialogs. It's familiar to users, accessible, and handles focus management.

**Alternatives considered**: `Notice` with action button — too easily dismissed; a modal forces deliberate action.
