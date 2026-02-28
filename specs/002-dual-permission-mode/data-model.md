# Data Model: Dual Permission Mode

**Date**: 2026-02-28 | **Branch**: `002-dual-permission-mode`

## Entities

### PermissionMode (type alias)

```typescript
type PermissionMode = "safe" | "super";
```

- `"safe"` (default): vault-only MCP tools, no SDK built-in tools, no `.claude/` config loaded
- `"super"`: SDK built-in tools available (per individual toggles), `.claude/` config loadable

### SdkToolToggles (interface)

Maps each SDK built-in tool to an enabled/disabled boolean. All default to `false`.

```typescript
interface SdkToolToggles {
  Read: boolean;
  Write: boolean;
  Edit: boolean;
  Bash: boolean;
  Glob: boolean;
  Grep: boolean;
  Skill: boolean;
  WebFetch: boolean;
  WebSearch: boolean;
  NotebookEdit: boolean;
}
```

**Validation**: All values must be boolean. Unknown keys are ignored on load (forward compatibility).

### ClaudeSettingSources (interface)

Controls which `.claude/` configuration levels are loaded, and whether memory is enabled per level.

```typescript
interface ClaudeSettingSources {
  projectSettings: boolean;   // .claude/settings.json + .claude/settings.local.json
  projectMemory: boolean;     // .claude/memory/
  userSettings: boolean;      // ~/.claude/settings.json
  userMemory: boolean;        // ~/.claude/memory/
}
```

**Default**: All `false`.

### ClaudeAgentSettings (extended interface)

The existing settings interface, extended with new fields:

```typescript
interface ClaudeAgentSettings {
  // Existing fields (unchanged)
  apiKey: string;
  authMethod: AuthMethod;
  maxContextSize: number;
  confirmFileOperations: boolean;
  model: string;

  // New fields
  permissionMode: PermissionMode;
  sdkToolToggles: SdkToolToggles;
  claudeSettingSources: ClaudeSettingSources;
}
```

**Persistence**: Stored via `saveData()`/`loadData()`. Default values applied via `Object.assign()` for backward compatibility with existing settings data.

## State Transitions

### Permission Mode Lifecycle

```
[Plugin Load]
    │
    ▼
  safe (default)
    │
    │ User toggles OFF safe mode
    │ (or clicks mode indicator)
    ▼
  [Confirmation Dialog]
    │           │
    │ Confirm   │ Cancel
    ▼           ▼
  super      safe (unchanged)
    │
    │ User toggles ON safe mode
    │ (or clicks mode indicator)
    ▼
  safe
```

**On every mode transition**: `AgentService.resetSession()` is called → next message starts fresh session with new options.

### Settings → SDK Options Mapping

```
permissionMode === "safe"
  → allowedTools: ["mcp__obsidian-vault__*"]
  → settingSources: undefined (not set)
  → mcpServers: { "obsidian-vault": vaultServer }

permissionMode === "super"
  → allowedTools: ["mcp__obsidian-vault__*", ...enabledSdkTools]
  → settingSources: [...enabledSources]  // computed from claudeSettingSources
  → mcpServers: { "obsidian-vault": vaultServer }
```

Where:
- `enabledSdkTools` = keys of `sdkToolToggles` where value is `true`
- `enabledSources` = computed array:
  - `projectSettings || projectMemory` → add `"project"`, `"local"`
  - `userSettings || userMemory` → add `"user"`

## Default Values

```typescript
const DEFAULT_SDK_TOOL_TOGGLES: SdkToolToggles = {
  Read: false,
  Write: false,
  Edit: false,
  Bash: false,
  Glob: false,
  Grep: false,
  Skill: false,
  WebFetch: false,
  WebSearch: false,
  NotebookEdit: false,
};

const DEFAULT_CLAUDE_SETTING_SOURCES: ClaudeSettingSources = {
  projectSettings: false,
  projectMemory: false,
  userSettings: false,
  userMemory: false,
};

const DEFAULT_SETTINGS: ClaudeAgentSettings = {
  apiKey: "",
  authMethod: "api_key",
  maxContextSize: 50_000,
  confirmFileOperations: true,
  model: "claude-sonnet-4-6",
  permissionMode: "safe",
  sdkToolToggles: { ...DEFAULT_SDK_TOOL_TOGGLES },
  claudeSettingSources: { ...DEFAULT_CLAUDE_SETTING_SOURCES },
};
```
