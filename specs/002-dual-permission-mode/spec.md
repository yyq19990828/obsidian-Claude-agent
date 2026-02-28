# Feature Specification: Dual Permission Mode

**Feature Branch**: `002-dual-permission-mode`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Add dual permission mode (safe mode with vault-only MCP tools and super mode with full SDK built-in tools, hooks, skills, plugins, and settingSources integration)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch between safe and super permission modes (Priority: P1)

As a user, I want to choose between two permission modes so that I can balance safety and power based on my needs. In **safe mode** (default), the agent can only read and modify notes within my vault through controlled MCP tools. In **super permission mode**, the agent gains access to full SDK built-in tools (Read, Write, Edit, Bash, etc.) and can operate beyond the vault boundary, giving me the full power of Claude Code within Obsidian.

**Why this priority**: This is the core feature — without the mode switch, no other stories are possible.

**Independent Test**: Can be fully tested by toggling the permission mode in settings and verifying that the agent's available tool set changes accordingly.

**Acceptance Scenarios**:

1. **Given** the plugin is loaded with default settings, **When** the user opens the chat panel, **Then** the agent operates in safe mode with only vault MCP tools available.
2. **Given** the user switches to super permission mode in settings, **When** the user sends a message, **Then** the agent has access to SDK built-in tools (Read, Write, Edit, Bash, Glob, Grep, etc.) in addition to vault MCP tools.
3. **Given** the user is in super permission mode, **When** they switch back to safe mode, **Then** the next conversation session uses only vault MCP tools, and SDK built-in tools are no longer available.
4. **Given** the user switches permission mode, **When** there is an active conversation, **Then** the mode change takes effect on the next message (not mid-conversation).

---

### User Story 2 - Super mode loads Claude Code ecosystem configuration (Priority: P2)

As a power user, I want super permission mode to automatically load my `.claude/` directory configuration so that hooks, skills, CLAUDE.md instructions, and MCP server definitions are available to the agent without manual setup.

**Why this priority**: This is the key differentiator of super mode — inheriting the Claude Code ecosystem makes it truly powerful, not just "more tools."

**Independent Test**: Can be tested by placing a `.claude/skills/` directory with a skill definition in the vault root, enabling super mode, and verifying the agent can discover and invoke that skill.

**Acceptance Scenarios**:

1. **Given** the vault has a `.claude/settings.json` with hook definitions, **When** super mode is enabled and settingSources includes "project", **Then** the agent loads and respects those hooks.
2. **Given** the vault has a `.claude/skills/` directory with skill definitions, **When** super mode is enabled with Skill in allowedTools, **Then** the agent can discover and invoke those skills.
3. **Given** the vault has a `CLAUDE.md` file, **When** super mode is enabled with settingSources including "project", **Then** the agent's system prompt includes the CLAUDE.md instructions.
4. **Given** the user has `~/.claude/settings.json` with user-level configuration, **When** super mode is enabled with settingSources including "user", **Then** the user-level settings are also loaded with correct precedence (local > project > user).

---

### User Story 3 - Risk warning when enabling super mode (Priority: P2)

As a user enabling super permission mode for the first time, I want to see a clear warning about the expanded capabilities so that I understand what I'm granting the agent access to before confirming.

**Why this priority**: Super mode grants filesystem and terminal access — users must make an informed decision. This is a safety and trust requirement.

**Independent Test**: Can be tested by toggling super mode on and verifying a confirmation dialog appears with capability descriptions.

**Acceptance Scenarios**:

1. **Given** the user is in safe mode, **When** they toggle the permission mode to super, **Then** a confirmation dialog appears explaining the expanded capabilities (file system access, terminal commands, access beyond vault).
2. **Given** the confirmation dialog is shown, **When** the user confirms, **Then** super mode is activated and the setting is persisted.
3. **Given** the confirmation dialog is shown, **When** the user cancels, **Then** the setting remains in safe mode.
4. **Given** the user has previously confirmed super mode and switches back to safe then back to super, **When** they toggle again, **Then** the warning dialog is shown again (every switch to super requires explicit confirmation).

---

### User Story 4 - Visual indicator of current permission mode (Priority: P3)

As a user, I want to see which permission mode is currently active in the chat panel so that I always know what level of access the agent has.

**Why this priority**: Clear visual feedback prevents confusion and builds trust, but is not functionally blocking.

**Independent Test**: Can be tested by switching modes and verifying the indicator updates in the chat panel.

**Acceptance Scenarios**:

1. **Given** the user is in safe mode, **When** they view the chat panel, **Then** a clickable visual indicator shows "Safe mode" or equivalent label.
2. **Given** the user is in super permission mode, **When** they view the chat panel, **Then** a clickable visual indicator shows "Super mode" or equivalent label with a distinct style to differentiate from safe mode.
3. **Given** the user is in safe mode, **When** they click the mode indicator, **Then** the confirmation warning for super mode is displayed (same as switching via settings).
4. **Given** the user is in super mode, **When** they click the mode indicator, **Then** the mode switches back to safe mode immediately (no confirmation needed for downgrading).

---

### Edge Cases

- What happens when the user enables super mode but no `.claude/` directory exists in the vault? The agent should still work with SDK built-in tools, just without ecosystem configuration.
- What happens when `.claude/settings.json` contains invalid JSON? The agent should log a warning and proceed without those settings, falling back to programmatic defaults.
- What happens when the user switches modes while the agent is processing a message? The mode change should be queued and applied to the next message.
- What happens when a skill or hook references tools not in the allowedTools list? The SDK handles this via its own precedence rules; programmatic allowedTools takes priority.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide two distinct permission modes: "safe" (default) and "super".
- **FR-002**: In safe mode, system MUST restrict agent tools to vault MCP tools only (`mcp__obsidian-vault__*`), matching current behavior.
- **FR-003**: In super mode, system MUST present each SDK built-in tool (Read, Write, Edit, Bash, Glob, Grep, Skill, etc.) as an individual toggle. Only tools explicitly enabled by the user are granted to the agent, in addition to vault MCP tools.
- **FR-004**: In super mode, system MUST provide two independent toggles for `.claude/` configuration sources: "User" (`~/.claude/`) and "Project" (vault `.claude/settings.json` + `.claude/settings.local.json` combined). Each can be independently enabled/disabled.
- **FR-005**: System MUST display a confirmation warning when the user switches to super mode, describing the expanded capabilities.
- **FR-006**: System MUST persist the selected permission mode across plugin reloads.
- **FR-007**: System MUST display a clickable visual indicator in the chat panel showing the current permission mode. Clicking the indicator MUST toggle the mode directly (switching to super mode still triggers the confirmation warning).
- **FR-008**: Permission mode changes MUST take effect on the next message, not mid-conversation. The active session should be reset when mode changes.
- **FR-009**: In super mode, vault MCP tools MUST remain available alongside SDK built-in tools, so the agent can choose the most appropriate tool for vault operations.
- **FR-010**: In super mode, the `cwd` for the SDK query MUST be set to the vault root path so that `.claude/` directory resolution works correctly.
- **FR-011**: Settings UI MUST use a tabbed layout with at least two tabs: "General" (authentication method, API key, model selection, max context size) and "Tools" (safe mode toggle, individual SDK tool toggles, .claude configuration sources, confirm file operations).
- **FR-012**: The Tools tab MUST feature an Apple-style toggle switch for safe mode. When safe mode is ON (default), all Claude Code native tool configurations below it MUST be visually disabled (grayed out).
- **FR-013**: The .claude configuration section in the Tools tab MUST present two independent toggles: "Project" (vault `.claude/settings.json` + `.claude/settings.local.json`) and "User" (`~/.claude/settings.json`). Each toggle independently controls whether that settings source is loaded.
- **FR-014**: Each individual SDK tool toggle MUST be visually disabled (grayed out) when safe mode is ON.
- **FR-015**: When super mode is first enabled, all SDK built-in tool toggles MUST default to OFF (disabled). Users must explicitly enable each tool they wish to use, following the principle of least privilege.
- **FR-016**: In the Tools tab, each configuration section (SDK built-in tools, .claude Project settings, .claude User settings, memory files, etc.) MUST be presented as a collapsible panel, defaulting to collapsed. Users click the section header to expand/collapse and reveal the individual toggles within.
- **FR-017**: In super mode, system MUST provide an optional "Memory files" toggle within the .claude configuration sections. When enabled, the agent can read and write to the auto-memory directory (e.g., `.claude/memory/` for project-level, `~/.claude/memory/` for user-level). This toggle MUST default to OFF and be independently controllable per level (project/user).

### Key Entities

- **PermissionMode**: Represents the active permission level — either "safe" or "super". Stored as a user preference. Determines which tools and configuration sources are available to the agent.
- **SettingSources**: Configuration sources loaded by the SDK, presented to user as two groups: "User" (`~/.claude/`) and "Project" (vault `.claude/settings.json` + `.claude/settings.local.json`). Only active in super mode. Each group can be independently toggled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between safe and super mode in under 3 seconds via the settings panel.
- **SC-002**: In safe mode, agent tool calls are limited exclusively to vault MCP tools — no SDK built-in tools are accessible.
- **SC-003**: In super mode, agent can successfully invoke SDK built-in tools (e.g., Bash to run a command, Read to access a file outside the vault).
- **SC-004**: In super mode with `.claude/skills/` present, agent can discover and invoke at least one skill.
- **SC-005**: 100% of permission mode switches to super mode display a confirmation warning before activation.
- **SC-006**: Permission mode selection persists correctly across plugin reload and Obsidian restart.

## Clarifications

### Session 2026-02-28

- Q: Super 模式下 SDK 内置工具的粒度控制方式？ → A: 逐个开关 — 每个 SDK 工具（Read, Write, Edit, Bash, Glob, Grep, Skill 等）独立显示一个开关，用户可精确控制每个工具的可用性。
- Q: General 标签页应包含哪些设置项？ → A: General = 认证方式 + API Key + 模型选择 + 最大上下文大小；Tools = 安全模式开关 + 工具开关 + .claude 配置 + 确认文件操作。
- Q: .claude 配置中 local 层级如何处理？ → A: 两个开关 — User（`~/.claude/`）和 Project（包含 `.claude/settings.json` + `.claude/settings.local.json`）。local 合并到 project 开关下。
- Q: Super 模式下 SDK 工具的默认状态？ → A: 默认全部关闭。用户进入 super 模式后需逐个开启需要的工具，遵循最小权限原则。
- Q: 聊天面板模式指示器的交互行为？ → A: 快捷切换 — 点击指示器直接切换模式，切换到 super 时仍弹出确认警告。
- Q: Tools 标签页中工具列表的展示方式？ → A: 每个配置区域（SDK 工具、.claude Project、.claude User 等）使用可折叠面板，默认收起，点击展开查看内部开关。
- Q: 记忆文件是否可配置？ → A: 是。在 .claude 配置区域中，每个层级（Project / User）各自包含一个 Memory files 开关，默认关闭，用户可选择是否启用 auto-memory 功能。

## Assumptions

- The vault is a desktop environment with file system access (`isDesktopOnly: true`).
- The Claude Agent SDK supports `settingSources` and expanded `allowedTools` as documented in the SDK v0.1.0+ API.
- Users enabling super mode understand they are granting capabilities beyond the vault boundary and accept the associated risks.
- The `.claude/` directory follows the standard Claude Code configuration structure.
- Safe mode remains the default to maintain backward compatibility and align with Obsidian's security-first developer policies.
