import { App, normalizePath, TFile } from "obsidian";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ToolCall, ToolPermission, VaultToolPermissions } from "../types";

function isPathValid(path: string): boolean {
	if (!path || path.startsWith("/") || path.includes("\\")) {
		return false;
	}

	const normalized = normalizePath(path);
	if (normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
		return false;
	}

	return true;
}

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

async function ensureParentFolders(app: App, path: string): Promise<void> {
	const normalized = normalizePath(path);
	const segments = normalized.split("/");
	segments.pop();

	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

async function checkVaultToolPermission(
	toolName: "write_note" | "edit_note",
	input: Record<string, unknown>,
	path: string,
	getPermission: (name: string) => ToolPermission,
	requestToolApproval: (toolCall: ToolCall) => Promise<boolean>
): Promise<{ allowed: boolean; reason?: string }> {
	const perm = getPermission(toolName);
	if (perm === "deny") {
		return { allowed: false, reason: "This tool is denied by your vault tool permissions." };
	}
	if (perm === "allow") {
		return { allowed: true };
	}
	/* perm === "ask" */
	const approved = await requestToolApproval({
		id: crypto.randomUUID(),
		toolName,
		input,
		status: "pending",
		filePath: path,
	});
	return { allowed: approved, reason: approved ? undefined : "User rejected this file operation." };
}

/**
 * Build the vault MCP server dynamically based on current permissions.
 * Only tools whose permission is NOT "deny" are registered.
 * Returns null if all tools are denied (no server needed).
 */
export function buildVaultMcpServer(
	app: App,
	permissions: VaultToolPermissions,
	getVaultToolPermission: (name: string) => ToolPermission,
	requestToolApproval: (toolCall: ToolCall) => Promise<boolean>
): ReturnType<typeof createSdkMcpServer> | null {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const tools: any[] = [];

	if (permissions.write_note !== "deny") {
		tools.push(tool(
			"write_note",
			"Create or overwrite a note in the current Obsidian vault.",
			{
				path: z.string().min(1),
				content: z.string(),
			},
			async ({ path, content }) => {
				if (!isPathValid(path)) {
					return textResult("Path is outside the vault boundary");
				}
				const check = await checkVaultToolPermission(
					"write_note", { path, content }, path, getVaultToolPermission, requestToolApproval
				);
				if (!check.allowed) {
					return textResult(check.reason ?? "Operation denied.");
				}
				const normalized = normalizePath(path);
				await ensureParentFolders(app, normalized);
				const file = app.vault.getAbstractFileByPath(normalized);
				if (file instanceof TFile) {
					await app.vault.modify(file, content);
				} else {
					await app.vault.create(normalized, content);
				}
				return textResult(`Successfully wrote to ${normalized}`);
			}
		));
	}

	if (permissions.edit_note !== "deny") {
		tools.push(tool(
			"edit_note",
			"Replace specific content inside an existing note.",
			{
				path: z.string().min(1),
				oldContent: z.string(),
				newContent: z.string(),
			},
			async ({ path, oldContent, newContent }) => {
				if (!isPathValid(path)) {
					return textResult("Path is outside the vault boundary");
				}
				const check = await checkVaultToolPermission(
					"edit_note", { path, oldContent, newContent }, path, getVaultToolPermission, requestToolApproval
				);
				if (!check.allowed) {
					return textResult(check.reason ?? "Operation denied.");
				}
				const normalized = normalizePath(path);
				const file = app.vault.getAbstractFileByPath(normalized);
				if (!(file instanceof TFile)) {
					return textResult(`File not found: ${normalized}`);
				}
				const content = await app.vault.read(file);
				if (!content.includes(oldContent)) {
					return textResult(`Could not find the specified content in ${normalized}`);
				}
				const matchCount = content.split(oldContent).length - 1;
				if (matchCount > 1) {
					return textResult("Multiple matches found. Please provide more context to identify the exact location.");
				}
				await app.vault.modify(file, content.replace(oldContent, newContent));
				return textResult(`Successfully modified ${normalized}`);
			}
		));
	}

	if (tools.length === 0) {
		return null;
	}

	return createSdkMcpServer({
		name: "obsidian-vault",
		version: "1.0.0",
		tools,
	});
}
