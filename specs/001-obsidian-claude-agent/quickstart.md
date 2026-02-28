# Quickstart: Obsidian Claude Agent Plugin (MVP)

**Branch**: `001-obsidian-claude-agent` | **Date**: 2026-02-28

## Prerequisites

- Node.js 18+ (LTS)
- npm
- Obsidian desktop app
- Anthropic API key OR Claude Code Max/Pro subscription with Claude Code installed

## Setup

```bash
# Clone and install
git clone <repo-url>
cd obsidian-Claude-agent
git checkout 001-obsidian-claude-agent
npm install

# Start development (watch mode)
npm run dev
```

## Install in Obsidian

1. Copy `main.js`, `manifest.json`, `styles.css` to:
   ```
   <Vault>/.obsidian/plugins/sample-plugin/
   ```
2. Open Obsidian → **Settings → Community plugins** → Enable "Sample Plugin"
3. Go to plugin settings → Enter API key or select Claude Code auth

## Project Structure

```
src/
├── main.ts              # Plugin entry point (lifecycle only)
├── settings.ts          # Settings interface, defaults, and settings tab
├── agent/
│   ├── agent-service.ts # Claude Agent SDK integration (query, streaming)
│   ├── vault-tools.ts   # MCP tool definitions (read, write, modify)
│   └── context.ts       # Active note context capture and truncation
├── ui/
│   ├── chat-view.ts     # ItemView sidebar panel
│   ├── message-renderer.ts # Message bubble rendering + markdown
│   └── tool-approval.ts # File operation confirmation UI
└── types.ts             # Shared TypeScript interfaces
```

## Key Dependencies

| Package                          | Purpose                          |
|----------------------------------|----------------------------------|
| `@anthropic-ai/claude-agent-sdk` | Claude Agent SDK (bundled)       |
| `zod`                            | Tool input schema validation     |
| `obsidian`                       | Obsidian API types (external)    |

## Build & Test

```bash
npm run build    # TypeScript check + esbuild production build
npm run dev      # esbuild watch mode
npm run lint     # ESLint check
```

## Architecture Overview

```
User Input → ChatView (UI)
                ↓
           AgentService.sendMessage(userText, noteContext)
                ↓
           query({ prompt: asyncGenerator, options: { mcpServers, includePartialMessages } })
                ↓
           SDK streams responses → ChatView renders tokens
                ↓
           Tool calls → VaultTools (read/write/modify via Obsidian Vault API)
                ↓
           Results rendered in chat
```
