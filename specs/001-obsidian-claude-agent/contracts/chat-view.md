# Chat View Contract: Sidebar Panel

**View type**: `claude-agent-chat-view`
**Position**: Right sidebar leaf

## Commands

| Command ID              | Name                    | Description                            |
|-------------------------|-------------------------|----------------------------------------|
| `open-chat-panel`       | Open Claude agent chat  | Opens/reveals the chat sidebar panel   |
| `clear-conversation`    | Clear conversation      | Clears current conversation history    |

## Ribbon Icon

| Icon    | Tooltip              | Action                        |
|---------|----------------------|-------------------------------|
| `bot`   | Claude agent chat    | Opens/reveals chat panel      |

## Settings Tab

| Setting                 | Type     | Control     | Description                                    |
|-------------------------|----------|-------------|------------------------------------------------|
| API key                 | string   | text input  | Anthropic API key (password-masked)            |
| Auth method             | enum     | dropdown    | "API key" or "Claude Code subscription"        |
| Max context size        | number   | text input  | Max characters for active note context         |
| Confirm file operations | boolean  | toggle      | Require approval before AI file writes         |
| Model                   | string   | dropdown    | Claude model selection                         |

## Chat Panel UI Structure

```
┌─────────────────────────────┐
│  Claude Agent            [×]│  ← Header with title and clear button
├─────────────────────────────┤
│                             │
│  [Welcome message]          │  ← Initial state
│                             │
│  ┌─ User ──────────────┐   │
│  │ User message text    │   │
│  └──────────────────────┘   │
│                             │
│  ┌─ Assistant ─────────┐   │
│  │ Markdown-rendered    │   │
│  │ response with code   │   │
│  │ blocks, lists, etc.  │   │
│  │                      │   │
│  │ [Tool: write_note]   │   │  ← Tool call indicator
│  │ ✓ Created note.md    │   │
│  └──────────────────────┘   │
│                             │
│  ┌─ Thinking... ────────┐  │  ← Loading indicator (when active)
│  │ ●●●                  │  │
│  └──────────────────────┘  │
│                             │
├─────────────────────────────┤
│  [Context: current-note.md] │  ← Active note indicator
├─────────────────────────────┤
│  [Message input...    ] [⏎] │  ← Input area with send button
└─────────────────────────────┘
```

## Event Flows

### Send Message
1. User types message in input → clicks send or presses Enter
2. Message added to conversation display (user bubble)
3. Input cleared, loading indicator shown
4. Active note content captured as context
5. SDK `query()` called with message + context
6. Stream events render tokens in assistant bubble
7. On completion, loading indicator removed

### Tool Call (confirm mode)
1. AI proposes file operation → tool call shown as "pending"
2. User sees approve/reject buttons
3. On approve → tool executes, result shown
4. On reject → rejection sent to AI, continues conversation

### Queue Message
1. User sends message while AI is responding
2. Message added to internal queue
3. Queue indicator shown ("1 message queued")
4. On response completion, next queued message auto-sent
