# SDK Options Usage Tracker

> Source: `@anthropic-ai/claude-agent-sdk` — `query({ prompt, options })` 的 `Options` 类型
> SDK 类型定义: `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`

---

## Legend

- [x] 已使用
- [ ] 未使用

---

## Session & Lifecycle

- [x] **`cwd`** — `string`
  - **用途**: 工作目录，SDK 子进程的 cwd
  - **位置**: `sdk-options-builder.ts:63` — 传入 vault 根路径
  - **来源**: `agent-service.ts` 从 `FileSystemAdapter.getBasePath()` 获取

- [x] **`resume`** — `string`
  - **用途**: 恢复已有会话（传入 sessionId）
  - **位置**: `sdk-options-builder.ts:66` — 从 `sessions` Map 读取
  - **来源**: `agent-service.ts:189` — `this.sessions.get(tabId)`

- [x] **`abortController`** — `AbortController`
  - **用途**: 取消正在进行的请求
  - **位置**: `sdk-options-builder.ts:67`
  - **来源**: `agent-service.ts:185` — 每次 `sendMessage()` 创建新实例

- [x] **`includePartialMessages`** — `boolean`
  - **用途**: 启用流式部分消息（逐 token 推送）
  - **位置**: `sdk-options-builder.ts:65` — 固定 `true`

- [ ] **`continue`** — `boolean`
  - **用途**: 继续上次未完成的回复（模型被截断时）
  - **潜在用途**: 当回复过长被截断时，自动续写。可在消息操作菜单中加"继续"按钮

- [ ] **`forkSession`** — `boolean`
  - **用途**: 从当前会话分叉出新会话（保留上下文）
  - **潜在用途**: 插件已有 `ConversationFork` 服务，可对接 SDK 原生分叉，比当前纯前端 fork 更完整

- [ ] **`persistSession`** — `boolean` (default: `true`)
  - **用途**: 是否将会话持久化到磁盘
  - **潜在用途**: 临时对话模式（不保存历史），可在"隐身对话"功能中使用

- [ ] **`sessionId`** — `string`
  - **用途**: 指定会话 ID（与 `resume` 不同，用于共享会话）
  - **潜在用途**: 跨标签页共享 SDK 会话，或与外部 Claude Code CLI 会话互通

- [ ] **`resumeSessionAt`** — `string`
  - **用途**: 从指定的消息 ID 位置恢复会话
  - **潜在用途**: 精确回滚到某条消息重新对话，比 `rewindMessages()` 更精确

---

## Model & Reasoning

- [x] **`model`** — `string`
  - **用途**: 指定使用的模型
  - **位置**: `sdk-options-builder.ts:64`
  - **来源**: `settings.model`（UI 设置 / config layer 覆盖）

- [ ] **`effort`** — `"low" | "medium" | "high" | "max"`
  - **用途**: 推理努力级别，控制模型思考深度
  - **潜在用途**: 对应 `settings.effortLevel`（目前定义了但未传给 SDK）。简单问题用 low 节省 token，复杂任务用 high/max

- [ ] **`thinking`** — `ThinkingConfig`
  - **类型**: `{ type: "adaptive" } | { type: "enabled", budgetTokens?: number } | { type: "disabled" }`
  - **用途**: 控制扩展思考（extended thinking）模式
  - **潜在用途**: 对应 `settings.thinkingBudget`（off/normal/extended），映射关系：
    - `"off"` → `{ type: "disabled" }`
    - `"normal"` → `{ type: "adaptive" }`
    - `"extended"` → `{ type: "enabled", budgetTokens: N }`

- [ ] **`fallbackModel`** — `string`
  - **用途**: 主模型失败（限流/不可用）时自动降级到备用模型
  - **潜在用途**: 配置 opus → sonnet → haiku 的降级链，提升可用性

- [ ] **`maxTurns`** — `number`
  - **用途**: 限制单次对话的最大轮数（agent loop 最大迭代）
  - **潜在用途**: 防止 agent 陷入无限循环。可在设置中加"最大轮数"选项

- [ ] **`maxBudgetUsd`** — `number`
  - **用途**: 设置单次对话的最大花费（美元）
  - **潜在用途**: 成本控制。可在设置中加预算限制，超过时自动停止

- [ ] **`betas`** — `SdkBeta[]` (当前仅 `"context-1m-2025-08-07"`)
  - **用途**: 启用 beta 功能
  - **潜在用途**: 启用 1M context window，处理大文件/长对话时非常有用

- [ ] ~~**`maxThinkingTokens`**~~ — `number` (deprecated)
  - **说明**: 已废弃，被 `thinking` 替代

---

## Tools & Permissions

- [x] **`allowedTools`** — `string[]`
  - **用途**: 自动允许的工具列表（不需要用户确认）
  - **位置**: `sdk-options-builder.ts:70`
  - **来源**: `tool-permission.ts:buildAllowedTools()` — 根据 `safeMode`、`sdkToolToggles`、`vaultToolPermissions` 构建

- [x] **`disallowedTools`** — `string[]`
  - **用途**: 完全禁用的工具（模型看不到）
  - **位置**: `sdk-options-builder.ts:71`
  - **来源**: `tool-permission.ts:buildDisallowedTools()` — `deny` 权限的 vault 工具

- [x] **`tools`** — `string[] | { type: 'preset', preset: 'claude_code' }`
  - **用途**: 可用工具集（模型能看到但不一定自动允许）
  - **位置**: `sdk-options-builder.ts:72` — 条件传入
  - **来源**: `tool-permission.ts:buildAvailableTools()` — permission-free + allow/ask 工具

- [x] **`permissionMode`** — `PermissionMode`
  - **用途**: 权限模式 (`default` / `acceptEdits` / `bypassPermissions` / `plan` / `dontAsk`)
  - **位置**: `sdk-options-builder.ts:73`
  - **来源**: `tool-permission.ts:buildPermissionMode()` — 根据 `settings.permissionMode` + safeMode 映射

- [x] **`allowDangerouslySkipPermissions`** — `boolean`
  - **用途**: 允许跳过所有权限检查
  - **位置**: `sdk-options-builder.ts:77` — 仅当 permMode === "bypassPermissions" 时启用

- [x] **`canUseTool`** — `CanUseTool` callback
  - **用途**: 工具使用审批回调函数
  - **位置**: `sdk-options-builder.ts:78`
  - **来源**: `tool-permission.ts:buildCanUseToolCallback()` — 根据 allow/ask/deny 逻辑路由

- [ ] **`permissionPromptToolName`** — `string`
  - **用途**: 自定义权限提示中显示的工具名称
  - **潜在用途**: 优先级低，仅在需要自定义权限 UI 文案时使用

---

## MCP Servers

- [x] **`mcpServers`** — `Record<string, McpServerConfig>`
  - **用途**: 注册 MCP 服务器（stdio/sse/http/sdk 四种类型）
  - **位置**: `sdk-options-builder.ts:57-60`
  - **来源**: 目前仅注册 `"obsidian-vault"` MCP server（vault-tools.ts）
  - **NOTE**: 插件 settings 中有 `mcpServers` 数组配置，但尚未传入 SDK（仅 vault MCP 生效）

- [ ] **`strictMcpConfig`** — `boolean`
  - **用途**: 严格 MCP 配置模式（无效配置报错而非忽略）
  - **潜在用途**: 开发调试时启用，帮助发现 MCP 配置错误

---

## Environment & Execution

- [x] **`env`** — `Record<string, string | undefined>`
  - **用途**: 环境变量（传给 CLI 子进程）
  - **位置**: `sdk-options-builder.ts:68`
  - **来源**: `sdk-options-builder.ts:buildEnv()` — `process.env` + `settings.envVars` + API Key

- [x] **`pathToClaudeCodeExecutable`** — `string`
  - **用途**: Claude Code CLI 可执行文件路径
  - **位置**: `sdk-options-builder.ts:80` — 条件传入
  - **来源**: `executable-resolver.ts:resolveClaudeExecutablePath()` — 自动搜索或用户指定

- [ ] **`executable`** — `"bun" | "deno" | "node"`
  - **用途**: 选择运行时（Node.js / Bun / Deno）
  - **潜在用途**: 优先级低。Obsidian 使用 Electron (Node)，通常不需要更改

- [ ] **`executableArgs`** — `string[]`
  - **用途**: 传给运行时的额外参数
  - **潜在用途**: 调试时传 `--inspect` 等 Node.js 参数

- [ ] **`extraArgs`** — `Record<string, string | null>`
  - **用途**: 传给 CLI 的额外命令行参数
  - **潜在用途**: 传递插件不直接支持的 CLI 参数，作为高级配置的逃生舱口

---

## Agents & Subagents

- [x] **`agents`** — `Record<string, AgentDefinition>`
  - **用途**: 注册自定义子代理
  - **位置**: `sdk-options-builder.ts:81` — 条件传入
  - **来源**: `agent-loader.ts:loadFileAgents()` — 从 3 层目录加载 .md agent 文件

- [ ] **`agent`** — `string`
  - **用途**: 指定使用哪个 agent（而非默认的 claude_code）
  - **潜在用途**: 让用户选择不同的 agent 配置启动对话（如"编程助手"、"写作助手"）

---

## Hooks

- [ ] **`hooks`** — `Partial<Record<HookEvent, HookCallbackMatcher[]>>`
  - **可用事件**: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`, `Setup`, `TeammateIdle`, `TaskCompleted`, `Elicitation`, `ElicitationResult`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`
  - **潜在用途**:
    - `PreToolUse`: 工具调用前审计/日志
    - `PostToolUse`: 工具执行后通知（Obsidian Notice）
    - `Stop`: 对话结束后自动总结/保存
    - `Notification`: 把 SDK 通知转发到 Obsidian 通知系统
    - 注意: settings.json 也可配置 hooks，SDK hooks 是程序化的补充

---

## System Prompt

- [ ] **`systemPrompt`** — `string | { type: "preset", preset: "claude_code", append?: string }`
  - **用途**: 自定义系统提示词，或在默认 claude_code 提示词基础上追加
  - **潜在用途**: **高价值**。可实现：
    - 追加 vault 上下文（当前笔记元信息、标签体系等）
    - 用户自定义人设/角色
    - 在 agent 文件中定义 system prompt
    - 注意: 目前上下文通过 `buildPrompt()` 拼接在 user message 中，改用 systemPrompt.append 更规范

---

## Output & Format

- [ ] **`outputFormat`** — `{ type: "json_schema", schema: Record<string, unknown> }`
  - **用途**: 强制模型输出符合 JSON Schema 的结构化数据
  - **潜在用途**: 需要结构化输出的场景（提取笔记元数据、生成 frontmatter、批量操作）

- [ ] **`promptSuggestions`** — `boolean`
  - **用途**: 启用提示建议（模型建议下一步操作）
  - **潜在用途**: 在对话结束后显示建议的后续问题

---

## Elicitation (SDK 反问)

- [ ] **`onElicitation`** — `OnElicitation` callback
  - **用途**: 处理 SDK/模型向用户发起的反问（如需要澄清、选择等）
  - **潜在用途**: **高价值**。目前插件有 `ask-user-card.ts` 组件，可对接 SDK 原生反问机制，实现更自然的交互

---

## Settings Sources

- [x] **`settingSources`** — `("user" | "project" | "local")[]`
  - **用途**: 告诉 CLI 读取哪些 settings.json / CLAUDE.md
  - **位置**: `sdk-options-builder.ts:79` — 条件传入
  - **来源**: `sdk-options-builder.ts:buildSettingSources()` — 根据 `claudeSettingSources` 开关

---

## Sandbox

- [ ] **`sandbox`** — `SandboxSettings`
  - **结构**:
    ```ts
    {
      enabled?: boolean;
      autoAllowBashIfSandboxed?: boolean;
      allowUnsandboxedCommands?: boolean;
      excludedCommands?: string[];
      enableWeakerNestedSandbox?: boolean;
      network?: {
        allowedDomains?: string[];
        allowManagedDomainsOnly?: boolean;
        allowUnixSockets?: string[];
        allowAllUnixSockets?: boolean;
        allowLocalBinding?: boolean;
        httpProxyPort?: number;
        socksProxyPort?: number;
      };
      filesystem?: {
        allowWrite?: string[];
        denyWrite?: string[];
        denyRead?: string[];
      };
      ignoreViolations?: Record<string, string[]>;
      ripgrep?: { command: string; args?: string[] };
    }
    ```
  - **潜在用途**: **高价值**。在 Obsidian 场景下限制 bash 命令的文件系统/网络访问，提升安全性。可对应 safe mode 的增强版

---

## Plugins

- [ ] **`plugins`** — `SdkPluginConfig[]`
  - **类型**: `{ type: "local", path: string }[]`
  - **用途**: 加载本地插件目录
  - **潜在用途**: 允许用户加载自定义 SDK 插件扩展功能

---

## File Checkpointing

- [ ] **`enableFileCheckpointing`** — `boolean`
  - **用途**: 启用文件检查点，支持通过 `rewindFiles()` 回滚文件更改
  - **潜在用途**: **高价值**。agent 修改 vault 文件后，如果用户不满意可以一键回滚到修改前状态

---

## Debug & Advanced

- [ ] **`debug`** — `boolean`
  - **用途**: 启用 SDK 调试输出
  - **潜在用途**: 开发者模式中启用，输出到 Obsidian 控制台

- [ ] **`debugFile`** — `string`
  - **用途**: 将调试日志写入指定文件
  - **潜在用途**: 排查问题时写到 vault 内的日志文件

- [ ] **`stderr`** — `(data: string) => void`
  - **用途**: 接收 CLI 子进程的 stderr 输出
  - **潜在用途**: 捕获错误信息显示在 UI 中，或写入日志

- [ ] **`spawnClaudeCodeProcess`** — `(options: SpawnOptions) => SpawnedProcess`
  - **用途**: 自定义 CLI 进程的启动方式
  - **潜在用途**: 优先级低。可用于 electron 环境的特殊进程管理需求

---

## Summary

| 分类 | 已用 | 未用 | 总计 |
|------|------|------|------|
| Session & Lifecycle | 4 | 5 | 9 |
| Model & Reasoning | 1 | 6 | 7 |
| Tools & Permissions | 6 | 1 | 7 |
| MCP Servers | 1 | 1 | 2 |
| Environment & Execution | 2 | 3 | 5 |
| Agents | 1 | 1 | 2 |
| Hooks | 0 | 1 | 1 |
| System Prompt | 0 | 1 | 1 |
| Output & Format | 0 | 2 | 2 |
| Elicitation | 0 | 1 | 1 |
| Settings Sources | 1 | 0 | 1 |
| Sandbox | 0 | 1 | 1 |
| Plugins | 0 | 1 | 1 |
| File Checkpointing | 0 | 1 | 1 |
| Debug & Advanced | 0 | 4 | 4 |
| **Total** | **16** | **29** | **45** |

### Priority Recommendations

**P0 — 应尽快使用:**
- `thinking` — 对应现有 `thinkingBudget` 设置，当前未接入
- `effort` — 对应现有 `effortLevel` 设置，当前未接入
- `onElicitation` — 对接现有 ask-user-card 组件
- `systemPrompt` — 比拼接 user message 更规范

**P1 — 明显提升体验:**
- `maxTurns` — 防止无限循环，安全保障
- `enableFileCheckpointing` — vault 文件修改回滚
- `hooks` (SDK 程序化) — 工具调用审计、通知转发
- `sandbox` — 安全模式增强
- `continue` — 长回复续写

**P2 — 锦上添花:**
- `fallbackModel` — 模型降级
- `maxBudgetUsd` — 成本控制
- `betas` — 1M context
- `forkSession` — 原生会话分叉
- `promptSuggestions` — 后续问题建议
- `debug`/`debugFile`/`stderr` — 开发者工具
