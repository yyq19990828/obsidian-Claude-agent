# Tasks: Dual Permission Mode

**Input**: Design documents from `/specs/002-dual-permission-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in spec. Manual testing via Obsidian vault plugin reload per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No new project structure needed. Verify existing setup supports the feature.

- [x] T001 Verify `styles.css` exists at project root (create empty file if missing) for custom toggle/tab/indicator styles

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, default constants, and CSS foundations that ALL user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `PermissionMode` type alias, `SdkToolToggles` interface, `ClaudeSettingSources` interface, and extend `ClaudeAgentSettings` with `permissionMode`, `sdkToolToggles`, `claudeSettingSources` fields in `src/types.ts`
- [x] T003 Update `DEFAULT_SETTINGS` in `src/settings.ts` to include `permissionMode: "safe"`, `sdkToolToggles` (all `false`), and `claudeSettingSources` (all `false`) with exported `DEFAULT_SDK_TOOL_TOGGLES` and `DEFAULT_CLAUDE_SETTING_SOURCES` constants
- [x] T004 Add base CSS for tabbed settings layout (`.claude-agent-settings-tabs`, `.claude-agent-tab-button`, `.claude-agent-tab-content`), Apple-style toggle (`.claude-agent-safe-toggle`), collapsible panels (`.claude-agent-collapsible`), and mode indicator (`.claude-agent-mode-indicator`) in `styles.css`

**Checkpoint**: Foundation ready — types, defaults, and CSS in place for all stories.

---

## Phase 3: User Story 1 — Switch between safe and super permission modes (Priority: P1) MVP

**Goal**: Users can choose between safe mode (vault-only MCP tools) and super mode (SDK built-in tools per individual toggles). Mode persists across reloads and takes effect on next message.

**Independent Test**: Toggle permission mode in settings, send a message, verify agent's available tool set changes accordingly.

### Implementation for User Story 1

- [x] T005 [US1] Rewrite `ClaudeAgentSettingTab.display()` in `src/settings.ts` to use a tabbed layout with "General" and "Tools" tabs. General tab contains: authentication method, API key, model selection, max context size. Tools tab contains: safe mode toggle (placeholder content for now)
- [x] T006 [US1] Add safe mode Apple-style toggle to the Tools tab in `src/settings.ts`. When safe mode is ON (default), all subsequent tool configuration sections are visually disabled (grayed out). When toggled OFF, sections become active. Toggling OFF does NOT yet trigger confirmation (US3 adds that)
- [x] T007 [US1] Add collapsible "SDK built-in tools" panel to the Tools tab in `src/settings.ts` with individual toggles for each SDK tool (Read, Write, Edit, Bash, Glob, Grep, Skill, WebFetch, WebSearch, NotebookEdit). All toggles disabled when safe mode is ON. Persist to `sdkToolToggles`
- [x] T008 [US1] Modify `AgentService.sendMessage()` in `src/agent/agent-service.ts` to read `permissionMode` and `sdkToolToggles` from settings. In safe mode: `allowedTools: ["mcp__obsidian-vault__*"]` (current behavior). In super mode: `allowedTools: ["mcp__obsidian-vault__*", ...enabledSdkTools]` where `enabledSdkTools` are keys from `sdkToolToggles` where value is `true`
- [x] T009 [US1] Add mode-change listener in `src/main.ts`: when `permissionMode` changes (detected on `saveSettings`), call `agentService.resetSession()` so the next message starts a fresh session with updated options. Add `onModeChange` callback to settings tab

**Checkpoint**: User Story 1 complete — safe/super mode switching works, tool set changes per mode, session resets on mode change, settings persist.

---

## Phase 4: User Story 2 — Super mode loads Claude Code ecosystem configuration (Priority: P2)

**Goal**: Super mode loads `.claude/` directory configuration (hooks, skills, CLAUDE.md, MCP servers) via SDK `settingSources`. Users control project-level and user-level sources independently.

**Independent Test**: Place a `.claude/skills/` directory with a skill definition in vault root, enable super mode with Project settings and Skill tool, verify agent discovers the skill.

### Implementation for User Story 2

- [x] T010 [P] [US2] Add collapsible ".claude Project settings" panel to the Tools tab in `src/settings.ts` with two toggles: "Settings" (`projectSettings`) and "Memory files" (`projectMemory`). Disabled when safe mode is ON. Persist to `claudeSettingSources`
- [x] T011 [P] [US2] Add collapsible ".claude User settings" panel to the Tools tab in `src/settings.ts` with two toggles: "Settings" (`userSettings`) and "Memory files" (`userMemory`). Disabled when safe mode is ON. Persist to `claudeSettingSources`
- [x] T012 [US2] Modify `AgentService.sendMessage()` in `src/agent/agent-service.ts` to compute and pass `settingSources` array in super mode. Map: `projectSettings || projectMemory` → add `"project"` and `"local"` to array; `userSettings || userMemory` → add `"user"` to array. Omit `settingSources` in safe mode
- [x] T013 [US2] In `AgentService.sendMessage()` in `src/agent/agent-service.ts`, set `cwd` to vault root path in super mode (already done, but verify it works for `.claude/` resolution). Ensure `cwd` is always the vault base path regardless of mode

**Checkpoint**: User Story 2 complete — `.claude/` configuration loads in super mode based on toggle state. Settings sources are independently controllable.

---

## Phase 5: User Story 3 — Risk warning when enabling super mode (Priority: P2)

**Goal**: A confirmation dialog warns users about expanded capabilities every time they switch to super mode, whether from settings or chat indicator.

**Independent Test**: Toggle super mode ON, verify confirmation dialog appears. Cancel and verify mode stays safe. Confirm and verify mode switches to super.

### Implementation for User Story 3

- [x] T014 [US3] Create `src/ui/confirmation-modal.ts` with a `SuperModeConfirmationModal` class extending Obsidian `Modal`. Display: title "Enable super mode", list of expanded capabilities (file system access, terminal commands, access beyond vault), "Enable" and "Cancel" buttons. Returns a `Promise<boolean>`
- [x] T015 [US3] Integrate confirmation modal into `src/settings.ts` safe mode toggle: when user toggles safe mode OFF, show `SuperModeConfirmationModal`. On confirm → set `permissionMode` to `"super"` and save. On cancel → revert toggle to ON and keep `permissionMode` as `"safe"`
- [x] T016 [US3] Export a reusable `requestSuperModeConfirmation(app: App): Promise<boolean>` function from `src/ui/confirmation-modal.ts` so both settings and chat indicator (US4) can invoke it

**Checkpoint**: User Story 3 complete — every switch to super mode requires explicit confirmation via modal dialog.

---

## Phase 6: User Story 4 — Visual indicator of current permission mode (Priority: P3)

**Goal**: A clickable badge in the chat panel header shows the current mode. Clicking toggles the mode (with confirmation for safe→super).

**Independent Test**: Open chat panel, verify mode badge appears. Click badge to toggle mode, verify badge updates and confirmation shows when switching to super.

### Implementation for User Story 4

- [x] T017 [US4] Add a clickable mode indicator element to the chat panel header in `src/ui/chat-view.ts`. Show "Safe mode" or "Super mode" with distinct CSS classes (`claude-agent-mode-safe`, `claude-agent-mode-super`). Place between the title and the clear button
- [x] T018 [US4] Extend `ChatViewConfig` in `src/ui/chat-view.ts` with `getPermissionMode: () => PermissionMode` and `onModeToggle: () => void` callbacks. Wire the indicator click to `onModeToggle`
- [x] T019 [US4] Implement mode toggle logic in `src/main.ts`: when `onModeToggle` fires, if current mode is `"super"` → switch to `"safe"` immediately (no confirmation). If current mode is `"safe"` → show `SuperModeConfirmationModal`, on confirm switch to `"super"`. Update chat view indicator after change
- [x] T020 [US4] Add `updateModeIndicator(mode: PermissionMode)` public method to `ChatView` in `src/ui/chat-view.ts` to update the badge text and CSS class. Call from `main.ts` after mode changes and on initial view open

**Checkpoint**: User Story 4 complete — mode indicator visible in chat, clickable to toggle, updates reactively.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, edge cases, and validation across all stories.

- [x] T021 [P] Handle edge case in `src/agent/agent-service.ts`: when super mode is enabled but no `.claude/` directory exists, agent proceeds with SDK tools only (no error)
- [x] T022 [P] Handle edge case in `src/agent/agent-service.ts`: when `.claude/settings.json` contains invalid JSON, log a warning via `console.warn` and proceed without those settings (SDK handles this, but document the behavior)
- [x] T023 [P] Handle edge case in `src/settings.ts`: when safe mode toggles ON while in super mode, ensure all tool toggle UI elements visually disable immediately without requiring page refresh
- [x] T024 Verify backward compatibility in `src/main.ts` `loadSettings()`: existing users without `permissionMode`/`sdkToolToggles`/`claudeSettingSources` in saved data get correct defaults via `Object.assign()` merge
- [x] T025 Run quickstart.md validation: verify all 5 test scenarios (safe mode default, super mode, .claude integration, mode indicator, settings persistence)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core feature, BLOCKS US3 (confirmation) and US4 (indicator)
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different code sections in settings and agent-service), but practically easier after US1 since it extends the Tools tab
- **US3 (Phase 5)**: Depends on US1 (needs safe mode toggle to integrate with)
- **US4 (Phase 6)**: Depends on US1 (needs mode state) and US3 (needs confirmation modal)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P2)**: Can start after Phase 2 — adds to Tools tab built by US1, but touches separate collapsible sections. Best done after US1
- **US3 (P2)**: Depends on US1 — integrates into the safe mode toggle
- **US4 (P3)**: Depends on US1 and US3 — uses confirmation modal and mode state

### Within Each User Story

- Types/defaults before implementation
- Settings UI before agent-service changes (for testability)
- Agent-service changes before main.ts wiring
- Core implementation before integration

### Parallel Opportunities

- T010 and T011 (US2 settings panels) can run in parallel
- T021, T022, T023 (polish edge cases) can run in parallel
- US2 implementation (T010-T013) could partially overlap with US1 if working on different files

---

## Parallel Example: User Story 2

```bash
# Launch both .claude settings panels in parallel (different collapsible sections):
Task: T010 "Add .claude Project settings panel in src/settings.ts"
Task: T011 "Add .claude User settings panel in src/settings.ts"
# Note: Same file but different sections — may need sequential if conflicts arise
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004)
3. Complete Phase 3: User Story 1 (T005-T009)
4. **STOP and VALIDATE**: Toggle modes, verify tool sets change, verify persistence
5. This delivers the core dual permission mode feature

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test mode switching → **MVP ready**
3. Add US2 → Test .claude integration → Ecosystem support
4. Add US3 → Test confirmation dialog → Safety layer
5. Add US4 → Test mode indicator → UX polish
6. Polish → Edge cases and validation → Release ready

### Recommended Execution Order

Single developer (sequential):
```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009
     → T010 → T011 → T012 → T013
     → T014 → T015 → T016
     → T017 → T018 → T019 → T020
     → T021-T025
```

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Safe mode toggle is the gatekeeper — all super-mode UI is grayed out when safe mode is ON
- Session reset on mode change ensures clean SDK state
- CSS in `styles.css` is shared across all stories — defined once in foundational phase
- No new directories needed per plan.md — changes are in existing files plus one new modal file
