# Claude Agent for Obsidian

在 Obsidian 侧边栏中直接和 Claude 对话，并让它在你的 Vault 内读取、写入、修改笔记（可选人工确认）。

本项目是一个 Obsidian 社区插件，基于 TypeScript + `@anthropic-ai/claude-agent-sdk` 实现。

## Features

- 侧边栏聊天视图（流式回复）
- 自动附带当前激活笔记上下文（支持最大长度限制）
- Vault MCP 工具：
    - `read_note`
    - `write_note`
    - `modify_note`
- 文件操作确认开关：
    - 开启后，写入/修改必须手动批准
    - 关闭后，写入/修改可直接执行
- 认证方式：
    - Claude Code（本地 `claude`）
    - API Key（`ANTHROPIC_API_KEY`）
- 聊天体验：消息队列、清空会话、复制、重新生成

## Requirements

- Obsidian Desktop
- Node.js 18+
- `npm`
- 本插件为桌面专用：`isDesktopOnly: true`

## Installation (Development)

1. 安装依赖

```bash
npm install
```

2. 开发构建（watch）

```bash
npm run dev
```

3. 生产构建

```bash
npm run build
```

4. 将以下文件放到你的插件目录：

- `main.js`
- `manifest.json`
- `styles.css`

目录示例：`<Vault>/.obsidian/plugins/claude-agent/`

## Settings

插件设置页包含以下选项：

- `Authentication method`
    - `Claude code`
    - `API key`
- `API key`
    - 仅在 `API key` 认证方式下使用
- `Max context size`
    - 每次请求附带的当前笔记最大字符数
- `Confirm file operations`
    - 是否在执行 `write_note` / `modify_note` 前要求确认
- `Model`
    - 例如 `claude-sonnet-4-6`

## Authentication

### Option 1: Claude Code

- 本机需可执行 `claude`
- 插件会尝试自动发现路径
- 也可手动设置环境变量：

```bash
export CLAUDE_CODE_PATH="/path/to/claude"
```

### Option 2: API Key

- 在插件设置中填写 API Key
- 运行时会通过环境变量注入 `ANTHROPIC_API_KEY`

## Safety Model

- 工具仅允许访问当前 Vault 内路径
- 阻止绝对路径、反斜杠路径和路径穿越（如 `../`）
- `Confirm file operations` 开启时：
    - `write_note` / `modify_note` 在真正执行前会弹出确认卡片
    - 拒绝后不会写入文件

## Commands

- `Open chat panel`
- `Clear conversation`

## Development

### Lint

```bash
npm run lint
```

### Build + Lint

```bash
npm run build && npm run lint
```

## Project Structure

```text
src/
    main.ts                 # 插件生命周期、命令、消息编排
    settings.ts             # 设置项定义与设置面板
    types.ts                # 共享类型
    agent/
        agent-service.ts      # Claude SDK 调用、流式事件处理
        context.ts            # 当前笔记上下文采集
        vault-tools.ts        # MCP 工具（读/写/改）
    ui/
        chat-view.ts          # 聊天视图
        message-renderer.ts   # 消息渲染、复制、重试
        tool-approval.ts      # 文件操作确认 UI
```

## Privacy

- 插件会向 Anthropic 服务发送你的对话内容，以及你允许附带/操作的笔记内容
- 不包含隐藏遥测
- 建议仅在你信任当前工作内容时启用文件写操作

## License

`0-BSD`
