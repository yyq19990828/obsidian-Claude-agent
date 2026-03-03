import type { ClaudeAgentSettings, ToolPermission, SdkToolToggles, ToolCall } from "../types";
import { PERMISSION_FREE_TOOLS } from "../constants";

const PERMISSION_FREE_SET = new Set(PERMISSION_FREE_TOOLS);

export function buildAllowedTools(settings: ClaudeAgentSettings): string[] {
	const allowed: string[] = [];

	/* IMPORTANT: The SDK converts allowedTools into "always allow" permission
	   rules (alwaysAllowRules.cliArg). Only tools with "allow" permission
	   should be listed here. "ask" tools must NOT be included — they need
	   to go through the canUseTool callback for user approval. */

	/* Vault MCP tools: only "allow" gets auto-allowed */
	const vaultPerms = settings.vaultToolPermissions;
	const vaultToolMap: Record<string, string> = {
		write_note: "mcp__obsidian-vault__write_note",
		edit_note: "mcp__obsidian-vault__edit_note",
	};
	for (const [key, mcpName] of Object.entries(vaultToolMap)) {
		const perm = (vaultPerms as unknown as Record<string, ToolPermission>)[key] ?? "ask";
		if (perm === "allow") {
			allowed.push(mcpName);
		}
	}

	/* Permission-free SDK tools — always allowed */
	allowed.push(...PERMISSION_FREE_TOOLS);

	/* Permission-required SDK tools: only "allow" gets auto-allowed.
	   "ask" tools are available via the `tools` option but NOT auto-allowed,
	   so the SDK's permission flow routes them to canUseTool. */
	if (!settings.safeMode) {
		for (const [name, perm] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, ToolPermission][]) {
			if (perm === "allow") {
				allowed.push(name);
			}
		}
	}
	return allowed;
}

export function buildDisallowedTools(settings: ClaudeAgentSettings): string[] {
	const disallowed: string[] = [];

	/* Vault MCP tools: hide "deny" tools from the model entirely */
	const vaultPerms = settings.vaultToolPermissions;
	const vaultToolMap: Record<string, string> = {
		write_note: "mcp__obsidian-vault__write_note",
		edit_note: "mcp__obsidian-vault__edit_note",
	};
	for (const [key, mcpName] of Object.entries(vaultToolMap)) {
		const perm = (vaultPerms as unknown as Record<string, ToolPermission>)[key] ?? "ask";
		if (perm === "deny") {
			disallowed.push(mcpName);
		}
	}

	return disallowed;
}

export function buildAvailableTools(settings: ClaudeAgentSettings): string[] | undefined {
	/* Permission-free tools are always available */
	const tools: string[] = [...PERMISSION_FREE_TOOLS];

	if (!settings.safeMode) {
		/* Super mode: add permission-required tools based on toggles */
		for (const [name, perm] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, ToolPermission][]) {
			if (perm === "allow" || perm === "ask") {
				tools.push(name);
			}
		}
	}
	return tools;
}

export function buildPermissionMode(settings: ClaudeAgentSettings): "default" | "acceptEdits" | "bypassPermissions" | "plan" {
	if (settings.safeMode) {
		/* Safe mode: no SDK tools enabled, vault MCP tools have their own
		   permission layer — acceptEdits is fine here. */
		return "acceptEdits";
	}

	const hasAskTools = Object.values(settings.sdkToolToggles).some(p => p === "ask") ||
		Object.values(settings.vaultToolPermissions).some(p => p === "ask");

	switch (settings.permissionMode) {
		case "auto_approve":
			if (!hasAskTools) return "bypassPermissions";
			/* When "ask" tools exist, use "default" so the SDK's internal
			   permission checker (GD) returns "ask" for tool operations,
			   routing them through our canUseTool callback.
			   "acceptEdits" would auto-allow file edits BEFORE our callback. */
			return "default";
		case "plan_only":
			return "plan";
		case "confirm":
			/* "default" ensures the SDK doesn't auto-allow any tool operations;
			   every tool call routes through canUseTool for user approval. */
			return "default";
		default:
			return "default";
	}
}

/** Build an "allow" result. `updatedInput` is required by CLI Zod schema
 *  and replaces the tool's input, so we must pass the original input through. */
function allowResult(input: Record<string, unknown>) {
	return { behavior: "allow" as const, updatedInput: input };
}

export function buildCanUseToolCallback(
	settings: ClaudeAgentSettings,
	requestToolApproval: (toolCall: ToolCall) => Promise<boolean>,
): (toolName: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ behavior: "allow" | "deny"; updatedInput?: Record<string, unknown>; message?: string }> {
	const askSdkTools = new Set<string>();
	const allowSdkTools = new Set<string>();
	if (!settings.safeMode) {
		for (const [name, perm] of Object.entries(settings.sdkToolToggles) as [keyof SdkToolToggles, ToolPermission][]) {
			if (perm === "ask") {
				askSdkTools.add(name);
			} else if (perm === "allow") {
				allowSdkTools.add(name);
			}
		}
	}

	/* In "auto_approve" mode, default is allow (only "ask" tools prompt).
	   In "confirm" mode, unconfigured tools prompt the user (true "confirm each action" semantics). */
	const isConfirmMode = settings.permissionMode === "confirm";

	return async (toolName: string, input: Record<string, unknown>, _options?: Record<string, unknown>) => {
		console.log(`[claude-agent] canUseTool called: ${toolName}, isConfirm=${isConfirmMode}, askTools=[${[...askSdkTools]}], allowTools=[${[...allowSdkTools]}]`);
		/* Permission-free tools (read-only / informational) → always allow */
		if (PERMISSION_FREE_SET.has(toolName)) {
			return allowResult(input);
		}
		/* MCP vault tools are handled by their own permission layer */
		if (toolName.startsWith("mcp__")) {
			return allowResult(input);
		}
		/* "ask" SDK tools → always prompt the user */
		if (askSdkTools.has(toolName)) {
			const toolCall: ToolCall = {
				id: crypto.randomUUID(),
				toolName,
				input,
				status: "pending",
				filePath: typeof input.file_path === "string" ? input.file_path : (typeof input.path === "string" ? input.path : undefined),
			};
			const approved = await requestToolApproval(toolCall);
			return approved
				? allowResult(input)
				: { behavior: "deny" as const, message: "User rejected tool call" };
		}
		/* "allow" SDK tools → auto-approve */
		if (allowSdkTools.has(toolName)) {
			return allowResult(input);
		}
		/* Fallback: confirm mode → prompt user for unconfigured tools;
		   otherwise (auto_approve / safe mode) → allow */
		if (isConfirmMode) {
			const toolCall: ToolCall = {
				id: crypto.randomUUID(),
				toolName,
				input,
				status: "pending",
				filePath: typeof input.file_path === "string" ? input.file_path : (typeof input.path === "string" ? input.path : undefined),
			};
			const approved = await requestToolApproval(toolCall);
			return approved
				? allowResult(input)
				: { behavior: "deny" as const, message: "User rejected tool call" };
		}
		return allowResult(input);
	};
}
