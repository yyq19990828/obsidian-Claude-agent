# Obsidian Claude Agent Plugin

@AGENTS.md for Obsidian plugin development guide (build, conventions, testing, security).

## Project overview
- Obsidian community plugin integrating Claude Agent SDK for AI agent capabilities
- Entry: `src/main.ts` → esbuild bundles to `main.js`
- Settings: `src/settings.ts` (MyPluginSettings interface)
- Manifest id: `sample-plugin` (rename before release)

## Claude Agent SDK integration notes
- SDK: `@anthropic-ai/claude-agent-sdk` (NOT `@anthropic-ai/sdk`)
- Supports Claude Code Max/Pro subscribers (no API key needed) and API key users
- Network requests to Anthropic API — must disclose to users with explicit opt-in
- `isDesktopOnly` MUST be `true` (Agent SDK requires Node.js)
- esbuild config: bundle the SDK into main.js, do NOT add to `external`
- Custom vault tools via MCP (`tool()` + `createSdkMcpServer`) for vault-aware file ops
- Follow Obsidian privacy policy: no hidden telemetry, clear disclosure of external services
