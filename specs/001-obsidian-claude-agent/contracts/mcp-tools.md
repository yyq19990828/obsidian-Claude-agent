# MCP Tool Contracts: Vault Operations

**Server name**: `obsidian-vault`
**Version**: `1.0.0`

## Tool: `read_note`

Read the content of a note from the Obsidian vault.

**Input Schema**:
| Field | Type   | Required | Description                              |
|-------|--------|----------|------------------------------------------|
| path  | string | yes      | Vault-relative path (e.g., `folder/note.md`) |

**Output**: File content as text, or error message if file not found.

**Errors**:
- File not found: `"File not found: {path}"`
- Not a file (is a folder): `"Path is a folder, not a file: {path}"`

---

## Tool: `write_note`

Create a new note or overwrite an existing note in the vault.

**Input Schema**:
| Field   | Type   | Required | Description                              |
|---------|--------|----------|------------------------------------------|
| path    | string | yes      | Vault-relative path for the note         |
| content | string | yes      | Full content to write                    |

**Output**: Confirmation message `"Successfully wrote to {path}"`.

**Behavior**:
- If file exists: overwrite content via `vault.modify()`
- If file doesn't exist: create via `vault.create()`
- If parent folders don't exist: create them automatically
- When `confirmFileOperations` is enabled: returns proposed changes for user approval before execution

**Errors**:
- Path outside vault: `"Path is outside the vault boundary"`
- Write failure: `"Failed to write to {path}: {error}"`

---

## Tool: `modify_note`

Modify a specific section or apply changes to an existing note.

**Input Schema**:
| Field      | Type   | Required | Description                                   |
|------------|--------|----------|-----------------------------------------------|
| path       | string | yes      | Vault-relative path of existing note          |
| oldContent | string | yes      | Text to find in the note                      |
| newContent | string | yes      | Text to replace it with                       |

**Output**: Confirmation message `"Successfully modified {path}"`.

**Behavior**:
- Finds `oldContent` in the file and replaces with `newContent`
- If `oldContent` not found: returns error
- When `confirmFileOperations` is enabled: shows diff for user approval

**Errors**:
- File not found: `"File not found: {path}"`
- Content not found: `"Could not find the specified content in {path}"`
- Multiple matches: `"Multiple matches found. Please provide more context to identify the exact location."`

---

## Tool Name Convention

When registered via `createSdkMcpServer({ name: "obsidian-vault" })`, tool names in the SDK follow the pattern:
- `mcp__obsidian-vault__read_note`
- `mcp__obsidian-vault__write_note`
- `mcp__obsidian-vault__modify_note`

The `allowedTools` option should be set to `["mcp__obsidian-vault__*"]` to allow all vault tools.
