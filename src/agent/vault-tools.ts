import { App, normalizePath, TFile } from "obsidian";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ToolCall } from "../types";

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

async function confirmWriteOperation(
	toolName: "write_note" | "modify_note",
	input: Record<string, unknown>,
	path: string,
	shouldConfirmFileOperations: () => boolean,
	requestToolApproval: (toolCall: ToolCall) => Promise<boolean>
): Promise<boolean> {
	if (!shouldConfirmFileOperations()) {
		return true;
	}

	return requestToolApproval({
		id: crypto.randomUUID(),
		toolName,
		input,
		status: "pending",
		filePath: path,
	});
}

export function createVaultMcpServer(
	app: App,
	shouldConfirmFileOperations: () => boolean,
	requestToolApproval: (toolCall: ToolCall) => Promise<boolean>
) {
	const readNote = tool(
		"read_note",
		"Read content from a note in the current Obsidian vault.",
		{
			path: z.string().min(1),
		},
		async ({ path }) => {
			if (!isPathValid(path)) {
				return textResult("Path is outside the vault boundary");
			}

			const file = app.vault.getAbstractFileByPath(normalizePath(path));
			if (!file) {
				return textResult(`File not found: ${path}`);
			}
			if (!(file instanceof TFile)) {
				return textResult(`Path is a folder, not a file: ${path}`);
			}

			const content = await app.vault.read(file);
			return textResult(content);
		}
	);

	const writeNote = tool(
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

			const approved = await confirmWriteOperation(
				"write_note",
				{ path, content },
				path,
				shouldConfirmFileOperations,
				requestToolApproval
			);
			if (!approved) {
				return textResult("User rejected this file operation.");
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
	);

	const modifyNote = tool(
		"modify_note",
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

			const approved = await confirmWriteOperation(
				"modify_note",
				{ path, oldContent, newContent },
				path,
				shouldConfirmFileOperations,
				requestToolApproval
			);
			if (!approved) {
				return textResult("User rejected this file operation.");
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
	);

	return createSdkMcpServer({
		name: "obsidian-vault",
		version: "1.0.0",
		tools: [readNote, writeNote, modifyNote],
	});
}
