# Roadmap

Target reference: [Claudian](https://github.com/YishenTu/claudian) (v1.3.66)

## Phase 1 — UI component refactor (current)

- [x] Split monolithic `settings.ts` into per-section modules (`src/settings/`)
- [x] Extract chat UI into reusable components (`src/ui/components/`)
- [x] Add state management layer (`src/state/` — conversation-store, event-bus, tab-manager)
- [x] Add inline-edit support (`src/ui/inline-edit/`)
- [x] Add modals for MCP server and slash commands (`src/ui/modals/`)
- [x] Add conversation sidebar (`src/ui/sidebar/`)
- [x] Expand styles.css with full component styling

## Phase 2 — Core infrastructure

- [ ] Security layer: ApprovalManager, BashPathValidator, BlocklistChecker, SecurityHooks
- [ ] Storage service: unified StorageService with VaultFileAdapter
- [ ] Session management: SessionManager, SessionStorage
- [ ] SDK abstraction: transformSDKMessage, type guards, SDK types
- [ ] Prompts module: system prompts for main agent, inline edit, title generation

## Phase 3 — Feature parity

- [ ] Multi-agent support: AgentManager, AgentStorage, SubagentManager
- [ ] MCP server management: McpServerManager, McpTester, McpStorage
- [ ] Plugin system: PluginManager with dynamic loading
- [ ] Slash command system: SlashCommandDropdown, SlashCommandStorage
- [ ] Tab system: full tab bar with TabManager
- [ ] Navigation sidebar with scroll buttons
- [ ] Canvas integration: CanvasSelectionController
- [ ] File @-mentions with vault folder cache
- [ ] Instruction refine mode
- [ ] Bang-bash mode (!command)

## Phase 4 — Quality & polish

- [ ] Internationalization (i18n): 10 language support
- [ ] Test suite: unit + integration tests with Jest
- [ ] CI/CD: GitHub Actions (lint, test, release)
- [ ] Modular CSS: split styles into per-component/feature CSS files
- [ ] Accessibility improvements
- [ ] Performance optimization (lazy init, debounce, batch disk access)

## Phase 5 — Release preparation

- [ ] Rename plugin ID from `claude-agent` to final name
- [ ] Bump minAppVersion to match API usage
- [ ] README with screenshots and usage guide
- [ ] Community plugin submission
