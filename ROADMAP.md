# Roadmap

Target reference: [Claudian](https://github.com/YishenTu/claudian) (v1.3.67)

---

## Phase 0 — 代码解耦与模块化 (首要任务)

代码文件逐渐臃肿，需要先结构重构，为后续功能开发打好基础。

### 0.1 拆分 agent-service.ts (718 行 → ~300 行)

`sendMessage()` 超过 270 行，混合了消息解析、权限管理、缓存、SDK 选项构建等职责。

- [ ] 提取 `src/agent/message-extractor.ts` — 10 个 SDK 消息解析函数 (extractTextDelta, extractThinkingDelta, extractToolCalls, extractToolResults, extractAssistantText)
- [ ] 提取 `src/agent/executable-resolver.ts` — Claude 可执行文件路径解析 (5 种候选策略)
- [ ] 提取 `src/agent/sdk-options-builder.ts` — SDK query options 组装 (env, permissionMode, canUseTool, mcpServers)
- [ ] 提取 `src/agent/tool-permission.ts` — 工具权限过滤 (buildAllowedTools, buildDisallowedTools, buildAvailableTools, canUseTool callback)
- [ ] agent-service.ts 精简为编排器：cache → options → query → yield events

### 0.2 拆分 main.ts (407 行 → ~200 行)

main.ts 应只负责插件生命周期，不应包含消息处理和事件分发。

- [ ] 提取 `src/services/message-processor.ts` — processMessage 循环 + agent 事件分发
- [ ] 提取 `src/services/message-queue.ts` — 消息队列管理 (loadingTabs, queues Map)
- [ ] 提取 `src/settings/settings-migrator.ts` — loadSettings 中的向后兼容迁移
- [ ] main.ts 保留：onload, onunload, addCommand, view 注册, saveSettings

### 0.3 拆分 message-renderer.ts (380 行 → ~200 行)

渲染逻辑、流式状态、工具卡片渲染混在一起。

- [ ] 提取 `src/ui/components/tool-call-renderer.ts` — 工具调用卡片 (renderToolCallCard, getToolIcon, truncatePath)
- [ ] 提取 `src/ui/components/message-actions.ts` — 消息操作栏 (复制、重新生成按钮)
- [ ] message-renderer.ts 保留：消息气泡结构、流式 token 处理、markdown 渲染

### 0.4 拆分 section-memory-config.ts (760 行 → ~300 行)

settings 中最大的文件，混合了文件 I/O、Modal、Schema 验证。

- [ ] 提取 `src/settings/modals/config-file-confirm-modal.ts` — 确认对话框
- [ ] 提取 `src/settings/memory-file-manager.ts` — CLAUDE.md / .claude-agent.json 文件读写
- [ ] section-memory-config.ts 保留：纯 UI 渲染

### 0.5 拆分 types.ts — ClaudeAgentSettings 分组

ClaudeAgentSettings 包含 20+ 不相关字段，被几乎所有文件导入。

- [ ] 创建分组接口：GeneralSettings, AuthSettings, ModelSettings, SafetySettings, ToolSettings, McpSettings, ConfigLayerSettings
- [ ] ClaudeAgentSettings 改为交叉类型组合 (`GeneralSettings & AuthSettings & ...`)，向后兼容
- [ ] 各模块按需导入具体分组，减少耦合面

### 0.6 CSS 模块化

所有样式在单个 `styles.css` 中。

- [ ] 创建 `src/style/` 目录：base/, components/, features/, settings/
- [ ] 按组件拆分 CSS，通过 `index.css` 统一导入
- [ ] 提取 CSS 变量到 `variables.css`

---

## Phase 1 — UI 组件重构 (已完成)

- [x] 拆分 settings.ts 为 per-section 模块 (`src/settings/`)
- [x] 提取聊天 UI 组件 (`src/ui/components/`)
- [x] 添加状态管理层 (`src/state/` — conversation-store, event-bus, tab-manager)
- [x] 添加 inline-edit (`src/ui/inline-edit/`)
- [x] 添加 MCP/slash command modals (`src/ui/modals/`)
- [x] 添加会话侧边栏 (`src/ui/sidebar/`)
- [x] 完善 styles.css

---

## Phase 2 — 核心体验增强

### 2.1 会话管理

- [ ] **Conversation Fork** — 从任意助手消息分叉对话
  - ForkSource 元数据 (sessionId, resumeAt)
  - 支持分叉到新 tab 或当前 tab
- [ ] **Rewind** — `/rewind {n}` 回退 N 条助手消息
- [ ] **Session Resume** — 追踪 sdkSessionId + previousSdkSessionIds，会话过期自动恢复

### 2.2 消息渲染

- [ ] **Diff 渲染** — 文件写入/编辑显示 inline diff
- [ ] **Subagent 渲染** — Task 工具嵌套展示子 agent 进度
- [ ] **用量统计** — 消息完成后显示 tokens/耗时
- [ ] **AskUserQuestion 内联卡片** — 替代 Modal，在聊天中直接交互

### 2.3 文件上下文系统

- [ ] **@-mention 文件/文件夹** — `@` 触发文件选择器，附加文件内容
- [ ] **文件缓存** — 后台索引 vault markdown，实时追踪重命名/删除
- [ ] **@-mention Agent** — `@agent-name` 切换 agent 上下文
- [ ] **上下文限制** — 可配置单次对话最大上下文

---

## Phase 3 — 新功能

### 3.1 输入增强

- [ ] **Slash Commands** — `/compact`, `/fork`, `/rewind`, 自定义命令 (`.claude/commands/*.md`)
- [ ] **Instruction Mode (#)** — `#` 前缀进入指令细化，AI 提问澄清后生成精准 prompt
- [ ] **Bang-Bash Mode (!)** — `!` 直接执行 bash，绕过 Claude
- [ ] **图片附件** — 粘贴/拖拽图片，Base64 编码，SHA-256 去重

### 3.2 Plan Mode

- [ ] 干运行所有工具调用，显示计划供审批
- [ ] `ExitPlanMode` 内联审批卡片 (Approve / Deny / New Session)
- [ ] Shift+Tab 快捷切换

### 3.3 标题生成

- [ ] 后台冷启动查询生成标题，不阻塞聊天
- [ ] 状态追踪：pending → success / failed

### 3.4 Inline Edit

- [ ] 选中文本编辑，只读工具权限
- [ ] 解析 `<replacement>` / `<insertion>` 标签，直接应用到编辑器

---

## Phase 4 — 安全与基础设施

### 4.1 安全层

- [ ] **CC 兼容权限规则** — `"Tool(pattern)"` 格式，存储在 `.claude/settings.json`
- [ ] **Bash 危险命令黑名单** — 平台感知，阻止 `rm -rf` 等
- [ ] **Vault 路径限制** — 默认只允许 vault 目录，可白名单外部路径

### 4.2 存储层重构

- [ ] **SDK 原生存储** — 消息存于 `~/.claude/projects/{vault}/{sessionId}/`
- [ ] **元数据覆盖层** — `vault/.claude/sessions/{id}.meta.json`
- [ ] **消息去重** — `message.id` 主键合并多源消息

### 4.3 MCP 管理增强

- [ ] MCP 测试工具 — Settings 内直接测试连接和工具调用
- [ ] Context-saving 服务器 — @-mention 激活
- [ ] Per-server 工具黑名单

### 4.4 Controller 模式

参考 claudian 的 controller 拆分，将 chat-view 逻辑分离：

- [ ] `StreamController` — 消息流处理与渲染编排
- [ ] `InputController` — 输入管理、slash command、@-mention
- [ ] `ConversationController` — 历史加载、会话切换、fork

---

## Phase 5 — 质量与发布

- [ ] **国际化 (i18n)** — 提取 UI 文本，支持 zh-CN / en
- [ ] **测试** — Jest 单元测试，核心模块覆盖
- [ ] **CI/CD** — GitHub Actions (lint, test, release)
- [ ] **键盘导航** — Vim 风格 j/k/i/g，可配置
- [ ] **无障碍** — 焦点管理、屏幕阅读器支持
- [ ] **插件 ID 重命名** — `sample-plugin` → 正式名
- [ ] **README** — 截图 + 使用指南
- [ ] **社区插件提交**
