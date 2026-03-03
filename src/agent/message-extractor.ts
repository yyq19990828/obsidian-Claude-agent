import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ToolCall } from "../types";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function extractAssistantText(message: SDKMessage): string {
	if (message.type !== "assistant") {
		return "";
	}

	const content = isRecord(message.message) ? message.message.content : undefined;
	if (!Array.isArray(content)) {
		return "";
	}

	const blocks = content as Array<{ type?: unknown; text?: unknown }>;
	const textBlocks = blocks
		.filter((block) => block.type === "text")
		.map((block) => (typeof block.text === "string" ? block.text : ""));
	return textBlocks.join("\n").trim();
}

export function extractToolCalls(message: SDKMessage): ToolCall[] {
	if (message.type !== "assistant") {
		return [];
	}

	const calls: ToolCall[] = [];
	const content = isRecord(message.message) ? message.message.content : undefined;
	if (!Array.isArray(content)) {
		return calls;
	}

	for (const block of content) {
		if (!isRecord(block) || block.type !== "tool_use") {
			continue;
		}

		const input = isRecord(block.input) ? block.input : {};
		const id = typeof block.id === "string" ? block.id : crypto.randomUUID();
		const toolName = typeof block.name === "string" ? block.name : "unknown_tool";
		calls.push({
			id,
			toolName,
			input,
			status: "pending",
			filePath: typeof input.path === "string" ? input.path : (typeof input.file_path === "string" ? input.file_path : undefined),
		});
	}
	return calls;
}

/**
 * Extract tool results from a `user` message that contains tool_result blocks.
 * The SDK sends these after executing tools, mapping tool_use_id → result content.
 */
export function extractToolResults(message: SDKMessage): Map<string, string> {
	const results = new Map<string, string>();
	if (message.type !== "user") {
		return results;
	}

	const content = isRecord(message.message) ? message.message.content : undefined;
	if (!Array.isArray(content)) {
		return results;
	}

	for (const block of content) {
		if (!isRecord(block) || block.type !== "tool_result") {
			continue;
		}

		const toolUseId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
		if (!toolUseId) continue;

		/* content can be a string or an array of content blocks */
		let resultText: string;
		if (typeof block.content === "string") {
			resultText = block.content;
		} else if (Array.isArray(block.content)) {
			const parts: string[] = [];
			for (const part of block.content) {
				if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
					parts.push(part.text);
				}
			}
			resultText = parts.join("\n");
		} else {
			resultText = "";
		}

		/* Truncate very long results for UI display */
		if (resultText.length > 2000) {
			resultText = resultText.slice(0, 2000) + "\n... (truncated)";
		}

		results.set(toolUseId, resultText);
	}
	return results;
}

export function extractTextDelta(message: SDKMessage): string | null {
	if (message.type !== "stream_event") {
		return null;
	}

	const event = message.event as unknown;
	if (!isRecord(event)) {
		return null;
	}

	if (event.type === "content_block_delta" && isRecord(event.delta) && event.delta.type === "text_delta" && typeof event.delta.text === "string") {
		return event.delta.text;
	}
	return null;
}

export function extractThinkingDelta(message: SDKMessage): string | null {
	if (message.type !== "stream_event") {
		return null;
	}

	const event = message.event as unknown;
	if (!isRecord(event)) {
		return null;
	}

	if (event.type === "content_block_delta" && isRecord(event.delta) && event.delta.type === "thinking_delta" && typeof event.delta.thinking === "string") {
		return event.delta.thinking;
	}
	return null;
}
