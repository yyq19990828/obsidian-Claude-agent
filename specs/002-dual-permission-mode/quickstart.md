# Quickstart: Dual Permission Mode

**Branch**: `002-dual-permission-mode`

## Build & Test

```bash
npm install
npm run dev          # Watch mode
# Copy main.js, manifest.json, styles.css to vault plugin folder
# Reload Obsidian, enable plugin
```

## Verify Safe Mode (Default)

1. Open plugin settings → **Tools** tab
2. Confirm "Safe mode" toggle is ON (default)
3. All SDK tool toggles and .claude config sections should be grayed out
4. Open chat panel → send a message
5. Agent should only use vault MCP tools (read_note, write_note, modify_note)

## Verify Super Mode

1. Open plugin settings → **Tools** tab
2. Toggle "Safe mode" OFF → confirmation dialog appears
3. Confirm → SDK tool section and .claude config sections become active
4. Expand "SDK Built-in Tools" → enable `Read` and `Bash`
5. Send a message asking to list files → agent should use `Bash` or `Read`
6. Verify vault MCP tools still work alongside SDK tools

## Verify .claude Integration

1. Create `.claude/skills/` directory in vault root with a skill definition
2. In Tools → expand ".claude Project" → enable Settings toggle
3. In SDK tools → enable `Skill`
4. Ask agent "What skills are available?" → should discover the skill

## Verify Mode Indicator

1. In chat panel header area, look for mode badge
2. Click the badge → should toggle mode (with confirmation for safe→super)
3. Badge text/style should update immediately

## Verify Settings Persistence

1. Configure super mode with some tools enabled
2. Reload Obsidian
3. Open settings → verify all toggles preserved
4. Open chat → verify mode indicator shows correct state
