# SDK Options vs settings.json — 详细区别

> 本文档梳理 Claude Agent SDK 的 `query({ options })` 参数与 Claude Code `settings.json` 配置文件之间的关系、区别和交互方式。

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Differences](#core-differences)
- [Field-by-Field Comparison](#field-by-field-comparison)
  - [Both — 两边都有](#both--两边都有)
  - [SDK Only — 仅 SDK 有](#sdk-only--仅-sdk-有)
  - [settings.json Only — 仅配置文件有](#settingsjson-only--仅配置文件有)
- [Interaction & Priority](#interaction--priority)
- [Plugin Architecture Implications](#plugin-architecture-implications)

---

## Architecture Overview

```
┌───────────────────────────────────────────────────┐
│  Obsidian Plugin (你的代码)                         │
│                                                    │
│  ┌──────────────┐    ┌─────────────────────────┐  │
│  │ UI Settings  │    │ Config Layer System      │  │
│  │ (data.json)  │    │ (settings-resolver.ts)   │  │
│  └──────┬───────┘    └────────────┬────────────┘  │
│         │                         │                │
│         └────────┬────────────────┘                │
│                  ▼                                  │
│  ┌──────────────────────────────┐                  │
│  │ sdk-options-builder.ts       │                  │
│  │ 构建 SDK Options 对象         │                  │
│  └──────────────┬───────────────┘                  │
│                 ▼                                   │
│  ┌──────────────────────────────┐                  │
│  │ query({ prompt, options })   │  ← SDK API 调用  │
│  └──────────────┬───────────────┘                  │
└─────────────────┼─────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────┐
│  Claude Code CLI 子进程                               │
│                                                      │
│  接收: SDK Options (通过 IPC)                         │
│                                                      │
│  自行读取 (如果 settingSources 允许):                  │
│  ├── ~/.claude/settings.json          (user)         │
│  ├── <vault>/.claude/settings.json    (project)      │
│  ├── <vault>/.claude/settings.local.json (local)     │
│  ├── ~/.claude/CLAUDE.md              (user memory)  │
│  └── <vault>/CLAUDE.md                (project memory)│
│                                                      │
│  合并后发送请求到 Claude API                           │
└──────────────────────────────────────────────────────┘
```

**关键要点:**

1. SDK Options 是**程序化参数**，通过 IPC 传给 CLI 子进程
2. settings.json 是**配置文件**，由 CLI 子进程自己从磁盘读取
3. 两者在 CLI 内部合并后共同决定最终行为
4. `settingSources` 选项控制 CLI 是否/读哪些配置文件

---

## Core Differences

| | SDK Options | settings.json |
|---|---|---|
| **性质** | 程序化 API 参数 (TypeScript 对象) | JSON 配置文件 |
| **传递方式** | 代码调用时传入，通过 IPC 传给 CLI | CLI 从磁盘自行读取 |
| **谁消费** | SDK → CLI 子进程 | CLI 子进程内部 |
| **生命周期** | 每次 `query()` 调用时设定 | 持久化在磁盘，跨会话生效 |
| **可包含回调** | 是 (`canUseTool`, `onElicitation`, `stderr`) | 否 (纯 JSON，不支持函数) |
| **修改方式** | 修改代码 | 编辑 JSON 文件或通过 UI |
| **适用场景** | 运行时动态控制 | 预设的静态配置 |
| **Schema 验证** | TypeScript 类型检查 | JSON Schema (`schemastore.org`) |
| **字段数量** | ~45 个 | ~80+ 个 |
| **用户可见** | 对最终用户透明 | 用户可直接编辑 |

---

## Field-by-Field Comparison

### Both — 两边都有

以下字段在 SDK Options 和 settings.json 中都有对应，但作用层面不同。

#### model

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `model: string` | `model: string` |
| **作用** | 直接指定本次 query 使用的模型 | CLI 的默认模型 |
| **优先级** | SDK 优先 — 如果传了则覆盖 settings.json 的值 |
| **插件使用** | `sdk-options-builder.ts:64` — 传入 `settings.model` |

#### env

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `env: Record<string, string>` | `env: Record<string, string>` |
| **作用** | 传给 CLI 子进程的环境变量 | CLI 读取后设置的环境变量 |
| **合并规则** | SDK env + settings.json env 合并，SDK 优先 |
| **插件使用** | `sdk-options-builder.ts:buildEnv()` — `process.env` + `settings.envVars` + API Key |

#### permissionMode

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `permissionMode: PermissionMode` | `permissions.defaultMode: string` |
| **类型差异** | `"default" \| "acceptEdits" \| "bypassPermissions" \| "plan" \| "dontAsk"` | `"default" \| "acceptEdits" \| "bypassPermissions" \| "plan" \| "dontAsk" \| "delegate"` |
| **优先级** | SDK 优先 |
| **插件使用** | `tool-permission.ts:buildPermissionMode()` — 映射 `settings.permissionMode` |

#### permissions / tools

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `allowedTools`, `disallowedTools`, `tools` | `permissions.allow`, `permissions.deny`, `permissions.ask` |
| **语法差异** | SDK: 工具名数组 `["Bash", "Read"]` | settings.json: 模式匹配 `["Bash(npm run *)", "Read(./.env)"]` |
| **颗粒度** | SDK: 工具级别（允许/禁止整个工具） | settings.json: 参数级别（允许 Bash 但只限 npm 命令） |
| **关系** | 互补 — SDK 控制工具可用性，settings.json 控制参数级规则 |
| **插件使用** | `tool-permission.ts` — 根据 `sdkToolToggles` 构建三个列表 |

#### hooks

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `hooks: object` |
| **类型差异** | SDK: 支持 JS 回调函数 | settings.json: 仅 command/prompt/agent/http 四种声明式 |
| **事件覆盖** | 相同的 20 种事件 |
| **合并规则** | 两边的 hooks 都会执行，不互相覆盖 |
| **插件使用** | 未使用 SDK hooks |

#### sandbox

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `sandbox: SandboxSettings` | `sandbox: object` |
| **结构** | 基本相同（enabled, network, filesystem, excludedCommands 等） |
| **优先级** | SDK 优先，但 managed settings.json 不可被覆盖 |
| **插件使用** | 未使用 SDK sandbox |

#### mcpServers

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `mcpServers: Record<string, McpServerConfig>` | 通过 `.mcp.json` 或 `enableAllProjectMcpServers` |
| **类型差异** | SDK: 支持 `type: "sdk"` (内存 MCP server) | settings.json: 仅 stdio/sse/http |
| **关系** | SDK 注册的 servers 与 settings.json 的 servers 合并 |
| **插件使用** | `sdk-options-builder.ts:57-60` — 注册 `"obsidian-vault"` SDK MCP server |

#### agents

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `agents: Record<string, AgentDefinition>` | `~/.claude/agents/` 和 `.claude/agents/` 目录下的 .md 文件 |
| **类型差异** | SDK: TypeScript 对象 | settings.json: Markdown 文件 + YAML frontmatter |
| **关系** | 两边的 agents 合并 |
| **插件使用** | `agent-loader.ts` — 从 3 层目录加载 .md 文件，转为 AgentDefinition 传入 SDK |

#### effort

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `effort: "low" \| "medium" \| "high" \| "max"` | `effortLevel: "low" \| "medium" \| "high"` |
| **差异** | SDK 多一个 `"max"` 级别 |
| **插件使用** | 未传入 SDK（settings 中定义了 `effortLevel` 但未接入） |

#### plugins

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `plugins: SdkPluginConfig[]` | `enabledPlugins: object` |
| **类型差异** | SDK: `{ type: "local", path: string }` 本地路径 | settings.json: 按插件 ID 启用/禁用，支持市场安装 |
| **关系** | 不同的插件系统 — SDK plugins 是代码级扩展，settings.json plugins 是 Claude Code 的插件市场 |
| **插件使用** | 均未使用 |

#### additionalDirectories

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `additionalDirectories: string[]` | `permissions.additionalDirectories: string[]` |
| **作用** | 相同 — 额外的工作目录 |
| **插件使用** | 未使用 |

#### settingSources

| | SDK Options | settings.json |
|---|---|---|
| **字段** | `settingSources: ("user" \| "project" \| "local")[]` | N/A |
| **作用** | 控制 CLI 是否读取 settings.json 文件 |
| **说明** | 这是 SDK 控制 settings.json 读取的"开关" |
| **插件使用** | `sdk-options-builder.ts:buildSettingSources()` |

---

### SDK Only — 仅 SDK 有

以下字段**只存在于 SDK Options 中**，settings.json 没有对应项。这些通常是运行时控制、回调函数、或程序化 API。

| 字段 | 类型 | 原因 |
|------|------|------|
| `abortController` | `AbortController` | 运行时取消控制，无法序列化为 JSON |
| `canUseTool` | `callback` | 回调函数，需要程序化实现 |
| `onElicitation` | `callback` | 回调函数，处理 SDK 反问 |
| `stderr` | `callback` | 回调函数，接收 stderr |
| `spawnClaudeCodeProcess` | `callback` | 回调函数，自定义进程启动 |
| `includePartialMessages` | `boolean` | 流式控制，仅对 SDK 消费者有意义 |
| `resume` | `string` | 会话恢复，运行时状态 |
| `sessionId` | `string` | 会话标识，运行时状态 |
| `resumeSessionAt` | `string` | 精确恢复点，运行时状态 |
| `continue` | `boolean` | 续写控制，运行时状态 |
| `forkSession` | `boolean` | 会话分叉，运行时操作 |
| `persistSession` | `boolean` | 持久化控制，运行时决策 |
| `prompt` (query 参数) | `string` | 用户输入，每次不同 |
| `systemPrompt` | `string \| object` | 系统提示词，程序化注入 |
| `outputFormat` | `JsonSchemaOutputFormat` | 结构化输出，按需使用 |
| `maxTurns` | `number` | 运行时限制，动态调整 |
| `maxBudgetUsd` | `number` | 预算控制，运行时限制 |
| `thinking` | `ThinkingConfig` | 思考模式配置（对象类型，非简单标量） |
| `fallbackModel` | `string` | 备用模型，运行时降级策略 |
| `betas` | `SdkBeta[]` | Beta 功能开关 |
| `enableFileCheckpointing` | `boolean` | 文件检查点，运行时功能 |
| `promptSuggestions` | `boolean` | 提示建议，UI 功能 |
| `debug` / `debugFile` | `boolean` / `string` | 调试控制 |
| `strictMcpConfig` | `boolean` | 开发调试 |
| `permissionPromptToolName` | `string` | UI 文案定制 |
| `allowDangerouslySkipPermissions` | `boolean` | 安全控制，需要程序化决策 |
| `extraArgs` | `Record<string, string>` | CLI 额外参数 |

**共性:** 这些字段要么是回调函数（无法 JSON 序列化），要么是运行时状态（每次调用可能不同），要么是对最终用户无意义的开发选项。

---

### settings.json Only — 仅配置文件有

以下字段**只存在于 settings.json 中**，SDK Options 没有对应项。这些由 CLI 内部处理。

#### UI & Display (CLI 终端显示)

| 字段 | 类型 | 说明 |
|------|------|------|
| `language` | `string` | 响应语言偏好 |
| `outputStyle` | `string` | 输出风格 |
| `showTurnDuration` | `boolean` | 显示轮次耗时 |
| `prefersReducedMotion` | `boolean` | 减少动画 |
| `terminalProgressBarEnabled` | `boolean` | 终端进度条 |
| `spinnerVerbs` | `object` | 自定义加载动词 |
| `spinnerTipsEnabled` | `boolean` | 加载提示 |
| `spinnerTipsOverride` | `object` | 自定义加载提示 |
| `companyAnnouncements` | `string[]` | 启动公告 |
| `statusLine` | `object` | 自定义状态栏 |

**对插件的影响:** 这些是 CLI 的终端 UI 设置，在 SDK 模式下 CLI 运行在后台无终端，**这些设置不生效**。插件有自己的 Obsidian UI。

#### Authentication (CLI 登录)

| 字段 | 类型 | 说明 |
|------|------|------|
| `apiKeyHelper` | `string` | 认证脚本 |
| `forceLoginMethod` | `enum` | 强制登录方式 |
| `forceLoginOrgUUID` | `string` | 指定组织 |
| `awsCredentialExport` | `string` | AWS 凭证脚本 |
| `awsAuthRefresh` | `string` | AWS 认证刷新 |

**对插件的影响:** 插件通过 SDK Options 的 `env` 传 `ANTHROPIC_API_KEY`，或通过 `pathToClaudeCodeExecutable` 使用 Claude Code CLI 的 OAuth。settings.json 的认证配置由 CLI 自行处理。

#### Permission Rules (细粒度模式匹配)

| 字段 | 类型 | 说明 |
|------|------|------|
| `permissions.allow` | `string[]` | 模式匹配规则 `Bash(npm run *)` |
| `permissions.deny` | `string[]` | 同上 |
| `permissions.ask` | `string[]` | 同上 |
| `permissions.disableBypassPermissionsMode` | `enum` | 禁止跳过权限 |

**对插件的影响:** 这些在 CLI 内部的权限系统中生效，与插件的 `canUseTool` 回调互补。CLI 先检查 settings.json 规则，未匹配时再调用 `canUseTool`。

#### MCP Management (CLI 的 MCP 管理)

| 字段 | 类型 | 说明 |
|------|------|------|
| `enableAllProjectMcpServers` | `boolean` | 自动批准项目 MCP |
| `enabledMcpjsonServers` | `string[]` | 指定批准的 server |
| `disabledMcpjsonServers` | `string[]` | 指定拒绝的 server |

**对插件的影响:** 控制 CLI 是否从 `.mcp.json` 加载 MCP servers。SDK 通过 Options 注册的 servers 不受这些控制。

#### Plugins & Marketplace

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabledPlugins` | `object` | 按 ID 启用/禁用插件 |
| `extraKnownMarketplaces` | `object` | 自定义插件市场 |
| `strictKnownMarketplaces` | `array` | (Managed) 市场白名单 |
| `blockedMarketplaces` | `array` | (Managed) 市场黑名单 |
| `skippedMarketplaces` | `string[]` | 跳过的市场 |
| `skippedPlugins` | `string[]` | 跳过的插件 |
| `pluginConfigs` | `object` | 插件配置 |

**对插件的影响:** 这是 Claude Code CLI 的插件生态系统，与 SDK 的 `plugins` (本地路径) 不同。

#### Attribution

| 字段 | 类型 | 说明 |
|------|------|------|
| `attribution.commit` | `string` | Git commit 归因 |
| `attribution.pr` | `string` | PR 归因 |

**对插件的影响:** 当 agent 使用 `Bash(git commit)` 时，CLI 会自动添加归因文本。

#### Maintenance

| 字段 | 类型 | 说明 |
|------|------|------|
| `cleanupPeriodDays` | `number` | 会话保留天数 |
| `autoUpdatesChannel` | `enum` | 更新通道 |
| `respectGitignore` | `boolean` | @ 选择器遵守 gitignore |
| `plansDirectory` | `string` | 计划文件目录 |
| `autoMemoryEnabled` | `boolean` | 自动记忆 |
| `fileSuggestion` | `object` | @ 自动补全 |

**对插件的影响:** 这些影响 CLI 的内部行为。`autoMemoryEnabled` 控制 CLI 是否自动写入 `.claude/memory/`。

#### Managed Settings (IT 管控)

| 字段 | 类型 | 说明 |
|------|------|------|
| `allowManagedPermissionRulesOnly` | `boolean` | 仅用管控规则 |
| `allowManagedHooksOnly` | `boolean` | 仅用管控钩子 |
| `allowManagedMcpServersOnly` | `boolean` | 仅用管控 MCP |
| `allowedMcpServers` | `array` | 管控 MCP 白名单 |
| `deniedMcpServers` | `array` | 管控 MCP 黑名单 |

**对插件的影响:** 企业环境中由 IT 部署，无法被 SDK Options 覆盖。

#### Agent Teams

| 字段 | 类型 | 说明 |
|------|------|------|
| `teammateMode` | `enum` | agent 显示模式 |

**对插件的影响:** CLI 多 agent 协作模式，目前属于实验性功能。

#### Telemetry

| 字段 | 类型 | 说明 |
|------|------|------|
| `otelHeadersHelper` | `string` | OTel headers 脚本 |

**对插件的影响:** 可用于企业监控集成。

---

## Interaction & Priority

当 SDK Options 和 settings.json 中的同名字段冲突时，优先级规则如下：

```
Managed settings.json (不可覆盖)
  ↓
SDK Options (程序化参数)
  ↓
Local settings.json (.claude/settings.local.json)
  ↓
Project settings.json (.claude/settings.json)
  ↓
User settings.json (~/.claude/settings.json)
  ↓
CLI 内部默认值
```

### 具体交互场景

#### 场景 1: model

```
SDK Options:  model = "claude-opus-4-6"
settings.json: model = "claude-sonnet-4-6"
→ 最终使用: claude-opus-4-6 (SDK 优先)
```

#### 场景 2: permissions

```
SDK Options:  allowedTools = ["Bash", "Read", "Edit"]
settings.json: permissions.deny = ["Bash(rm -rf *)"]
→ 最终效果: Bash 工具可用，但 rm -rf 命令会被 CLI 内部拦截
  (SDK 允许工具级别，settings.json 限制参数级别)
```

#### 场景 3: hooks

```
SDK Options:  hooks.PreToolUse = [{ matcher: "Bash", hooks: [callback] }]
settings.json: hooks.PreToolUse = [{ matcher: "Bash", hooks: [{ type: "command", ... }] }]
→ 最终效果: 两个 hook 都会执行 (合并，不覆盖)
```

#### 场景 4: managed 限制

```
Managed settings.json: permissions.deny = ["WebFetch"]
SDK Options:  allowedTools = ["WebFetch"]
→ 最终效果: WebFetch 被禁止 (Managed 不可覆盖)
```

#### 场景 5: settingSources 关闭

```
SDK Options:  settingSources = undefined (不传)
settings.json: 存在各种配置
→ 最终效果: CLI 不读取任何 settings.json (等同于全部关闭)
  但 Managed settings 仍然生效 (不受 settingSources 控制)
```

---

## Plugin Architecture Implications

### 当前插件的架构选择

插件采用**双层控制**策略:

1. **SDK Options 层** — 插件代码直接控制
   - `sdk-options-builder.ts` 根据插件 UI 设置构建 Options
   - 工具权限通过 `canUseTool` 回调实现
   - MCP vault server 通过 SDK 注册

2. **settings.json 层** — 通过 `settingSources` 间接控制
   - 用户可在 settings.json 中配置细粒度权限规则
   - `claudeSettingSources` 开关决定是否让 CLI 读取这些文件
   - 插件的 Config Layer System 提供 UI 可视化管理

### 设计原则

| 类型 | 应通过 SDK Options | 应通过 settings.json |
|------|------|------|
| 运行时动态控制 | model, permissionMode, abortController | — |
| 回调/交互 | canUseTool, onElicitation, stderr | — |
| 工具级别权限 | allowedTools, disallowedTools | — |
| 参数级别权限 | — | permissions.allow/deny/ask |
| 静态配置 | — | language, outputStyle, attribution |
| CLI 行为 | — | cleanupPeriodDays, autoMemoryEnabled |
| 安全策略 | sandbox (可选) | sandbox, managed settings |
| 自定义扩展 | mcpServers (SDK type), agents | mcpServers (stdio/sse), plugins marketplace |

### 避免的陷阱

1. **不要在两边重复设置同一个值** — 比如 model，如果 SDK 和 settings.json 都设了，会造成混淆。插件应该选一边作为"主控"。

2. **settings.json 的 permissions 比 SDK allowedTools 更细** — SDK 只能说"允许 Bash"，settings.json 可以说"允许 Bash 但只限 npm 命令"。两者互补而非替代。

3. **settingSources 是总开关** — 如果不传 settingSources，CLI 不会读任何 settings.json。插件当前通过 `claudeSettingSources` UI 开关控制这个行为。

4. **Managed settings 无法被覆盖** — 企业环境中的 managed-settings.json 优先级最高，SDK Options 也无法覆盖。插件无需处理这种情况（由 CLI 自动处理）。
