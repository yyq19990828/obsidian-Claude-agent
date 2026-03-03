# Claude Code Settings Schema Reference

> Official schema: `https://json.schemastore.org/claude-code-settings.json`
> Official docs: https://code.claude.com/docs/en/settings

This document describes all configurable fields in Claude Code `settings.json`, for use in the plugin's config layer system.

---

## Table of Contents

- [Configuration Scopes](#configuration-scopes)
- [Core Settings](#core-settings)
  - [Model](#model)
  - [Permissions](#permissions)
  - [Environment Variables](#environment-variables)
  - [Hooks](#hooks)
  - [Sandbox](#sandbox)
  - [MCP Servers](#mcp-servers)
  - [Plugins](#plugins)
  - [Attribution](#attribution)
  - [UI & Display](#ui--display)
  - [File & Directory](#file--directory)
  - [Authentication](#authentication)
  - [Performance & Maintenance](#performance--maintenance)
  - [Agent Teams](#agent-teams)
  - [AWS / Cloud Integration](#aws--cloud-integration)
  - [Telemetry](#telemetry)
- [Environment Variables Reference](#environment-variables-reference)
- [Permission Rule Syntax](#permission-rule-syntax)
- [Sandbox Path Prefixes](#sandbox-path-prefixes)
- [Hook Types](#hook-types)
- [Plugin Marketplace Sources](#plugin-marketplace-sources)
- [Example Configurations](#example-configurations)

---

## Configuration Scopes

Settings are resolved in a fixed priority order. Higher scopes override lower scopes.

| Priority | Scope | Location | Shared |
|----------|-------|----------|--------|
| 1 (highest) | Managed | Server / MDM / `managed-settings.json` | Yes (IT deployed) |
| 2 | CLI args | Command line flags | No (session only) |
| 3 | Local | `.claude/settings.local.json` | No (gitignored) |
| 4 | Project | `.claude/settings.json` | Yes (committed) |
| 5 (lowest) | User | `~/.claude/settings.json` | No (personal) |

### Merge rules

- **Scalar fields** (string, number, boolean): higher scope overwrites.
- **Array fields** (permissions, servers): concatenated and deduplicated.
- **Object fields** (env, sdkToolToggles): shallow merge at key level.
- **Managed settings** cannot be overridden by user/project.

### File locations

```
~/.claude/settings.json                     # User (global)
.claude/settings.json                       # Project (shared via git)
.claude/settings.local.json                 # Local (gitignored, personal)
~/.claude.json                              # Preferences, OAuth, MCP, state

# Managed (platform-specific)
/Library/Application Support/ClaudeCode/managed-settings.json   # macOS
/etc/claude-code/managed-settings.json                           # Linux/WSL
C:\Program Files\ClaudeCode\managed-settings.json                # Windows

# Memory
~/.claude/CLAUDE.md                         # User memory
CLAUDE.md or .claude/CLAUDE.md              # Project memory
.claude/CLAUDE.local.md                     # Local memory

# Agents
~/.claude/agents/                           # User subagents
.claude/agents/                             # Project subagents

# MCP
.mcp.json                                  # Project-scoped MCP servers
```

### Schema validation

Add `$schema` to enable IDE autocomplete (VS Code, Cursor, etc.):

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json"
}
```

---

## Core Settings

### Model

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | `string` | — | Override default model (e.g. `"claude-sonnet-4-6"`, `"claude-opus-4-6"`) |
| `availableModels` | `string[]` | — | Restrict selectable models in UI |
| `effortLevel` | `"low" \| "medium" \| "high"` | `"high"` | Reasoning effort level |
| `fastMode` | `boolean` | `false` | Enable fast output mode |
| `alwaysThinkingEnabled` | `boolean` | — | Enable extended thinking by default |

---

### Permissions

Controls which tools Claude can use and which files it can access.

| Field | Type | Description |
|-------|------|-------------|
| `permissions.allow` | `string[]` | Tools/paths auto-approved |
| `permissions.ask` | `string[]` | Tools/paths requiring user confirmation |
| `permissions.deny` | `string[]` | Tools/paths blocked |
| `permissions.additionalDirectories` | `string[]` | Extra working directories |
| `permissions.defaultMode` | `enum` | Default permission mode (see below) |
| `permissions.disableBypassPermissionsMode` | `"disable"` | Prevent `--dangerously-skip-permissions` |
| `allowManagedPermissionRulesOnly` | `boolean` | (Managed only) Only use managed rules |

**`defaultMode` values:**

| Value | Description |
|-------|-------------|
| `"default"` | Standard permission checking |
| `"acceptEdits"` | Auto-accept file edits |
| `"plan"` | Plan mode (no edits without approval) |
| `"bypassPermissions"` | Skip all permission checks |
| `"dontAsk"` | Never prompt (deny if not allowed) |
| `"delegate"` | Delegate to subagent |

**Evaluation order:** deny -> ask -> allow (first match wins).

See [Permission Rule Syntax](#permission-rule-syntax) for pattern format.

---

### Environment Variables

| Field | Type | Description |
|-------|------|-------------|
| `env` | `Record<string, string>` | Environment variables applied to sessions |

Key pattern: `^[A-Z_][A-Z0-9_]*$` (uppercase only).

```json
{
  "env": {
    "NODE_ENV": "development",
    "CUSTOM_API_URL": "https://api.example.com"
  }
}
```

---

### Hooks

Event-driven lifecycle hooks that execute on specific events.

| Field | Type | Description |
|-------|------|-------------|
| `hooks` | `object` | Event -> hook array mapping |
| `disableAllHooks` | `boolean` | Disable all hooks globally |
| `allowManagedHooksOnly` | `boolean` | (Managed only) Only managed/SDK hooks |
| `allowedHttpHookUrls` | `string[]` | HTTP hook URL allowlist (wildcards) |
| `httpHookAllowedEnvVars` | `string[]` | Env vars HTTP hooks can access |

**Available hook events:**

| Event | Trigger |
|-------|---------|
| `PreToolUse` | Before a tool executes |
| `PostToolUse` | After a tool executes successfully |
| `PostToolUseFailure` | After a tool execution fails |
| `PermissionRequest` | When a permission prompt is shown |
| `Notification` | On notification events |
| `UserPromptSubmit` | When user submits a prompt |
| `Stop` | When agent stops |
| `SubagentStart` | When a subagent starts |
| `SubagentStop` | When a subagent stops |
| `PreCompact` | Before context compaction |
| `TeammateIdle` | When a teammate agent idles |
| `TaskCompleted` | When a task completes |
| `Setup` | On initial setup |
| `ConfigChange` | When configuration changes |
| `WorktreeCreate` | When a worktree is created |
| `WorktreeRemove` | When a worktree is removed |
| `SessionStart` | When a session starts |
| `SessionEnd` | When a session ends |

See [Hook Types](#hook-types) for hook configuration format.

---

### Sandbox

Isolates bash commands in a restricted environment.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sandbox.enabled` | `boolean` | — | Enable bash sandboxing |
| `sandbox.autoAllowBashIfSandboxed` | `boolean` | `true` | Auto-approve sandboxed commands |
| `sandbox.excludedCommands` | `string[]` | — | Commands that run outside sandbox |
| `sandbox.allowUnsandboxedCommands` | `boolean` | `true` | Allow `dangerouslyDisableSandbox` |
| `sandbox.enableWeakerNestedSandbox` | `boolean` | `false` | Weak sandbox for unprivileged Docker |

**Filesystem restrictions:**

| Field | Type | Description |
|-------|------|-------------|
| `sandbox.filesystem.allowWrite` | `string[]` | Writable paths (merged across scopes) |
| `sandbox.filesystem.denyWrite` | `string[]` | Non-writable paths |
| `sandbox.filesystem.denyRead` | `string[]` | Unreadable paths |

**Network restrictions:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sandbox.network.allowedDomains` | `string[]` | — | Outbound domains (wildcard `*` supported) |
| `sandbox.network.allowUnixSockets` | `string[]` | — | Accessible Unix socket paths |
| `sandbox.network.allowAllUnixSockets` | `boolean` | `false` | Allow all Unix sockets |
| `sandbox.network.allowLocalBinding` | `boolean` | — | Allow localhost binding (macOS) |
| `sandbox.network.httpProxyPort` | `number` | — | Custom HTTP proxy port |
| `sandbox.network.socksProxyPort` | `number` | — | Custom SOCKS5 proxy port |
| `sandbox.network.allowManagedDomainsOnly` | `boolean` | — | (Managed) Only managed domains |

See [Sandbox Path Prefixes](#sandbox-path-prefixes) for path syntax.

---

### MCP Servers

| Field | Type | Description |
|-------|------|-------------|
| `enableAllProjectMcpServers` | `boolean` | Auto-approve all project `.mcp.json` servers |
| `enabledMcpjsonServers` | `string[]` | Specific servers to approve |
| `disabledMcpjsonServers` | `string[]` | Specific servers to reject |
| `allowedMcpServers` | `object[]` | (Managed) MCP server allowlist |
| `deniedMcpServers` | `object[]` | (Managed) MCP server blocklist |
| `allowManagedMcpServersOnly` | `boolean` | (Managed) Only use managed allowlist |

**MCP server specification format:**

```json
{ "serverName": "github" }
{ "command": "npx @modelcontextprotocol/server-github" }
{ "url": "https://mcp.example.com/sse" }
```

---

### Plugins

| Field | Type | Description |
|-------|------|-------------|
| `enabledPlugins` | `object` | Plugin ID -> `boolean \| string[] \| null` |
| `extraKnownMarketplaces` | `object` | Custom marketplace sources |
| `strictKnownMarketplaces` | `array` | (Managed) Marketplace allowlist |
| `blockedMarketplaces` | `array` | (Managed) Blocked marketplace sources |
| `skippedMarketplaces` | `string[]` | Skipped marketplace names |
| `skippedPlugins` | `string[]` | Skipped plugin IDs |
| `pluginConfigs` | `object` | Per-plugin configuration |

See [Plugin Marketplace Sources](#plugin-marketplace-sources) for marketplace config format.

---

### Attribution

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `attribution.commit` | `string` | — | Git commit trailer text |
| `attribution.pr` | `string` | — | Pull request attribution text |
| `includeCoAuthoredBy` | `boolean` | `true` | (Deprecated) Include Co-Authored-By |

```json
{
  "attribution": {
    "commit": "Generated with AI\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
    "pr": "Generated with Claude Code"
  }
}
```

---

### UI & Display

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `language` | `string` | — | Preferred response language (e.g. `"chinese"`, `"japanese"`) |
| `outputStyle` | `string` | — | System prompt style (e.g. `"Concise"`, `"Explanatory"`) |
| `showTurnDuration` | `boolean` | `true` | Show turn duration |
| `prefersReducedMotion` | `boolean` | `false` | Reduce UI animations |
| `terminalProgressBarEnabled` | `boolean` | `true` | Show terminal progress bar |
| `spinnerTipsEnabled` | `boolean` | `true` | Show spinner tips |
| `companyAnnouncements` | `string[]` | — | Startup announcements (random) |

**Custom spinner verbs:**

```json
{
  "spinnerVerbs": {
    "mode": "append",
    "verbs": ["Pondering", "Contemplating"]
  }
}
```

**Custom spinner tips:**

```json
{
  "spinnerTipsOverride": {
    "excludeDefault": true,
    "tips": ["Press Esc to interrupt", "Use /help for commands"]
  }
}
```

**Custom status line:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

---

### File & Directory

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `respectGitignore` | `boolean` | `true` | Exclude `.gitignore` files from `@` picker |
| `plansDirectory` | `string` | `"~/.claude/plans"` | Plan file storage directory |
| `autoMemoryEnabled` | `boolean` | `true` | Auto-save context to `.claude/memory/` |

**Custom file suggestion (@ autocomplete):**

```json
{
  "fileSuggestion": {
    "type": "command",
    "command": "~/.claude/file-suggestion.sh"
  }
}
```

---

### Authentication

| Field | Type | Description |
|-------|------|-------------|
| `apiKeyHelper` | `string` | Script path for auth values (sent as `X-Api-Key` + `Authorization: Bearer`) |
| `forceLoginMethod` | `"claudeai" \| "console"` | Restrict login method |
| `forceLoginOrgUUID` | `string` | Auto-select organization UUID |

---

### Performance & Maintenance

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cleanupPeriodDays` | `integer` | `30` | Days before inactive sessions are deleted |
| `autoUpdatesChannel` | `"stable" \| "latest"` | `"latest"` | Update channel |
| `fastModePerSessionOptIn` | `boolean` | — | Require per-session fast mode opt-in |
| `skipWebFetchPreflight` | `boolean` | — | Skip WebFetch blocklist check |

---

### Agent Teams

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `teammateMode` | `"auto" \| "in-process" \| "tmux"` | `"auto"` | Agent display mode |

---

### AWS / Cloud Integration

| Field | Type | Description |
|-------|------|-------------|
| `awsCredentialExport` | `string` | Script outputting JSON AWS credentials |
| `awsAuthRefresh` | `string` | Script to refresh AWS authentication |

---

### Telemetry

| Field | Type | Description |
|-------|------|-------------|
| `otelHeadersHelper` | `string` | Script for dynamic OpenTelemetry headers |

---

## Environment Variables Reference

### Authentication

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude SDK |
| `ANTHROPIC_AUTH_TOKEN` | Custom Authorization header value |
| `ANTHROPIC_CUSTOM_HEADERS` | Custom headers (Name: Value, newline-separated) |
| `ANTHROPIC_FOUNDRY_API_KEY` | Microsoft Foundry auth |
| `ANTHROPIC_FOUNDRY_BASE_URL` | Foundry resource URL |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Foundry resource name |
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API key |

### Model

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_MODEL` | Model name override |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Haiku model override |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Sonnet model override |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Opus model override |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Subagent model |
| `CLAUDE_CODE_EFFORT_LEVEL` | `low`, `medium`, `high` |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output tokens (default: 32000, max: 64000) |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | Disable 1M context window (set `1`) |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | Disable adaptive reasoning (set `1`) |

### Shell & Bash

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_SHELL` | Override shell detection |
| `CLAUDE_CODE_SHELL_PREFIX` | Command prefix for all bash |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Return to original dir after bash (set `1`) |
| `BASH_DEFAULT_TIMEOUT_MS` | Default timeout for bash commands |
| `BASH_MAX_TIMEOUT_MS` | Maximum timeout user can set |
| `BASH_MAX_OUTPUT_LENGTH` | Max bash output chars |

### Feature Flags

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_SIMPLE` | Minimal mode: Bash/Read/Edit only (set `1`) |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | Disable fast mode (set `1`) |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable auto memory (set `1`) |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | Disable background tasks (set `1`) |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | Disable terminal title updates (set `1`) |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | Enable prompt suggestions (set `false` to disable) |
| `CLAUDE_CODE_ENABLE_TASKS` | Enable task tracking (set `false` for TODO list) |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable OpenTelemetry (set `1`) |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable agent teams (set `1`) |

### File & Memory

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | Override file read token limit |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | Load CLAUDE.md from `--add-dir` (set `1`) |
| `CLAUDE_CODE_TASK_LIST_ID` | Shared task list across sessions |
| `CLAUDE_CODE_TMPDIR` | Override temp directory |
| `CLAUDE_CONFIG_DIR` | Customize config/data storage location |

### Cloud Provider Flags

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock (set `1`) |
| `CLAUDE_CODE_USE_FOUNDRY` | Use Microsoft Foundry (set `1`) |
| `CLAUDE_CODE_USE_VERTEX` | Use Google Vertex (set `1`) |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | Skip AWS auth (set `1`) |
| `CLAUDE_CODE_SKIP_FOUNDRY_AUTH` | Skip Azure auth (set `1`) |
| `CLAUDE_CODE_SKIP_VERTEX_AUTH` | Skip Google auth (set `1`) |

### Disable Features

| Variable | Description |
|----------|-------------|
| `DISABLE_AUTOUPDATER` | Disable auto-updates (set `1`) |
| `DISABLE_BUG_COMMAND` | Disable `/bug` command (set `1`) |
| `DISABLE_COST_WARNINGS` | Disable cost warnings (set `1`) |
| `DISABLE_ERROR_REPORTING` | Opt out of Sentry (set `1`) |
| `DISABLE_TELEMETRY` | Opt out of Statsig telemetry (set `1`) |
| `DISABLE_PROMPT_CACHING` | Disable all prompt caching (set `1`) |
| `DISABLE_PROMPT_CACHING_HAIKU` | Disable Haiku caching (set `1`) |
| `DISABLE_PROMPT_CACHING_OPUS` | Disable Opus caching (set `1`) |
| `DISABLE_PROMPT_CACHING_SONNET` | Disable Sonnet caching (set `1`) |
| `DISABLE_NON_ESSENTIAL_MODEL_CALLS` | Disable flavor text generation (set `1`) |
| `DISABLE_INSTALLATION_CHECKS` | Disable install warnings (set `1`) |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | Disable anthropic-beta headers (set `1`) |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | Disable session quality surveys (set `1`) |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disable updates/telemetry/error reporting (set `1`) |
| `CLAUDE_CODE_HIDE_ACCOUNT_INFO` | Hide email/org in UI (set `1`) |

### Plugins

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | Git timeout for plugin ops (default: 120000ms) |
| `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` | Skip IDE extension auto-install (set `1`) |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | Enable claude.ai MCP servers |
| `ENABLE_TOOL_SEARCH` | MCP tool search: `auto`, `auto:N%`, `true`, `false` |

### Automation & SDK

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Exit after idle (milliseconds) |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | Require plan approval (agent teams) |
| `CLAUDE_CODE_TEAM_NAME` | Agent team membership name |
| `CLAUDE_CODE_ACCOUNT_UUID` | Account UUID (SDK mode) |
| `CLAUDE_CODE_ORGANIZATION_UUID` | Org UUID (SDK mode) |
| `CLAUDE_CODE_USER_EMAIL` | User email (SDK mode) |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` | Credential refresh interval |
| `CLAUDE_CODE_AUTOCOMPACT_PCT_OVERRIDE` | Auto-compaction trigger (1-100 percent) |

### mTLS & Security

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_CLIENT_CERT` | mTLS client certificate path |
| `CLAUDE_CODE_CLIENT_KEY` | mTLS private key path |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | mTLS key passphrase |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | Allow proxy DNS resolution (set `true`) |

---

## Permission Rule Syntax

Permission rules use the format `Tool` or `Tool(specifier)`:

```
Bash                        # All bash commands
Bash(npm run *)             # Pattern matching with wildcard
Bash(git commit *)          # Git commit commands
Read(./.env)                # Specific file
Read(src/**/*.ts)           # Glob pattern
Edit(src/**)                # All files under src/
Write(dist/**)              # All files under dist/
WebFetch                    # All web fetches
WebFetch(domain:example.com) # Domain-specific
MCP(server:github)          # MCP server access
Agent(subagent:*)           # All subagent access
```

**Supported tools in rules:**

`Bash`, `Edit`, `Glob`, `Grep`, `Read`, `Write`, `WebFetch`, `WebSearch`,
`Task`, `Skill`, `NotebookEdit`, `NotebookRead`, `LSP`, `Agent`,
`MCP(server:*)`, `mcp__*`

---

## Sandbox Path Prefixes

| Prefix | Resolves to | Example |
|--------|-------------|---------|
| `//` | Absolute filesystem root | `//tmp/build` -> `/tmp/build` |
| `~/` | Home directory | `~/.kube` -> `$HOME/.kube` |
| `/` | Settings file directory | `/build` -> `$SETTINGS_DIR/build` |
| `./` or none | Relative (sandbox runtime) | `./dist` |

---

## Hook Types

Each hook event supports an array of hook configurations. Four types available:

### 1. Command hook

Execute a shell command.

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "/path/to/script.sh $TOOL_INPUT",
    "timeout": 30000,
    "async": false,
    "statusMessage": "Running validation..."
  }]
}
```

### 2. Prompt hook

LLM evaluation (returns allow/deny/abstain).

```json
{
  "matcher": "Edit",
  "hooks": [{
    "type": "prompt",
    "prompt": "Does this edit follow our coding standards?",
    "model": "haiku",
    "timeout": 10000
  }]
}
```

### 3. Agent hook

Multi-turn verification with tool access.

```json
{
  "matcher": "Write",
  "hooks": [{
    "type": "agent",
    "prompt": "Verify this file creation is safe",
    "tools": ["Read", "Glob"],
    "model": "sonnet"
  }]
}
```

### 4. HTTP hook

POST to webhook endpoint.

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "http",
    "url": "https://hooks.example.com/validate",
    "headers": {
      "Authorization": "Bearer ${HOOK_TOKEN}"
    },
    "timeout": 5000
  }]
}
```

### Hook environment variables

Hooks receive context via environment variables:

| Variable | Description |
|----------|-------------|
| `$TOOL_NAME` | Name of the tool being used |
| `$TOOL_INPUT` | JSON-encoded tool input |
| `$SESSION_ID` | Current session ID |
| `$CONVERSATION_ID` | Current conversation ID |

---

## Plugin Marketplace Sources

Marketplaces define where plugins are discovered. Multiple source types supported:

### GitHub repository

```json
{
  "source": "github",
  "repo": "acme-corp/plugins",
  "ref": "v2.0",
  "path": "marketplace"
}
```

### Git repository

```json
{
  "source": "git",
  "url": "https://gitlab.example.com/tools/plugins.git",
  "ref": "production"
}
```

### URL

```json
{
  "source": "url",
  "url": "https://plugins.example.com/marketplace.json",
  "headers": { "Authorization": "Bearer ${TOKEN}" }
}
```

### NPM package

```json
{
  "source": "npm",
  "package": "@acme-corp/claude-plugins"
}
```

### File path

```json
{
  "source": "file",
  "path": "/usr/local/share/claude/marketplace.json"
}
```

### Directory path

```json
{
  "source": "directory",
  "path": "/opt/acme-corp/plugins"
}
```

### Host pattern (regex)

```json
{
  "source": "hostPattern",
  "hostPattern": "^github\\.example\\.com$"
}
```

---

## Example Configurations

### Team standardization (`.claude/settings.json`)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Bash(git diff)",
      "Bash(git commit *)",
      "Read(src/**)",
      "Edit(src/**)"
    ],
    "ask": [
      "Bash(git push *)",
      "Edit(package.json)"
    ],
    "deny": [
      "Bash(curl *)",
      "Bash(rm -rf *)",
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Personal preference (`~/.claude/settings.json`)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "language": "chinese",
  "outputStyle": "Concise",
  "model": "claude-sonnet-4-6",
  "spinnerTipsEnabled": false,
  "showTurnDuration": true,
  "cleanupPeriodDays": 14
}
```

### Enterprise lockdown (`managed-settings.json`)

```json
{
  "allowManagedPermissionRulesOnly": true,
  "allowManagedHooksOnly": true,
  "allowManagedMcpServersOnly": true,
  "permissions": {
    "deny": [
      "Read(.env*)",
      "Bash(curl *)",
      "WebFetch"
    ]
  },
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "company/approved-plugins" }
  ],
  "sandbox": {
    "enabled": true,
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"],
      "allowManagedDomainsOnly": true
    },
    "filesystem": {
      "denyRead": ["~/.aws/credentials", "~/.ssh/"]
    }
  }
}
```

### Sandbox configuration

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["git", "docker"],
    "filesystem": {
      "allowWrite": ["//tmp/build", "~/.kube", "./dist"],
      "denyRead": ["~/.aws/credentials"]
    },
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org", "registry.yarnpkg.com"],
      "allowUnixSockets": ["/var/run/docker.sock"],
      "allowLocalBinding": false
    }
  }
}
```
