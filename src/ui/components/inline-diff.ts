/**
 * Read-only inline diff renderer for Edit/Write tool calls.
 * Uses simple line-by-line comparison (no accept/reject).
 */

const MAX_DIFF_LINES = 100;
const MAX_PREVIEW_LINES = 20;

/**
 * Render an inline diff showing additions and removals between old and new text.
 */
export function renderInlineDiff(parentEl: HTMLElement, oldText: string, newText: string): void {
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const diffLines = computeLineDiff(oldLines, newLines);

	const container = parentEl.createDiv({ cls: "claude-agent-inline-diff" });

	const needsTruncation = diffLines.length > MAX_DIFF_LINES;
	const visibleLines = needsTruncation ? diffLines.slice(0, MAX_DIFF_LINES) : diffLines;

	const pre = container.createEl("pre", { cls: "claude-agent-diff-pre" });
	for (const line of visibleLines) {
		const lineEl = pre.createEl("div", { cls: `claude-agent-diff-line ${line.type}` });
		const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
		lineEl.createSpan({ cls: "claude-agent-diff-prefix", text: prefix });
		lineEl.createSpan({ cls: "claude-agent-diff-text", text: line.text });
	}

	if (needsTruncation) {
		const remaining = diffLines.length - MAX_DIFF_LINES;
		const moreBtn = container.createEl("button", {
			cls: "claude-agent-diff-show-more",
			text: `Show ${remaining} more lines`,
		});
		moreBtn.addEventListener("click", () => {
			moreBtn.remove();
			for (const line of diffLines.slice(MAX_DIFF_LINES)) {
				const lineEl = pre.createEl("div", { cls: `claude-agent-diff-line ${line.type}` });
				const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
				lineEl.createSpan({ cls: "claude-agent-diff-prefix", text: prefix });
				lineEl.createSpan({ cls: "claude-agent-diff-text", text: line.text });
			}
		});
	}
}

/**
 * Render a content preview for Write/write_note operations.
 * Shows first N lines with optional expand.
 */
export function renderContentPreview(parentEl: HTMLElement, content: string, filePath: string): void {
	const container = parentEl.createDiv({ cls: "claude-agent-inline-diff" });
	const header = container.createDiv({ cls: "claude-agent-diff-header" });
	header.createSpan({ text: filePath, cls: "claude-agent-diff-filepath" });

	const lines = content.split("\n");
	const needsTruncation = lines.length > MAX_PREVIEW_LINES;
	const visibleLines = needsTruncation ? lines.slice(0, MAX_PREVIEW_LINES) : lines;

	const pre = container.createEl("pre", { cls: "claude-agent-diff-pre" });
	for (const line of visibleLines) {
		const lineEl = pre.createEl("div", { cls: "claude-agent-diff-line added" });
		lineEl.createSpan({ cls: "claude-agent-diff-prefix", text: "+" });
		lineEl.createSpan({ cls: "claude-agent-diff-text", text: line });
	}

	if (needsTruncation) {
		const remaining = lines.length - MAX_PREVIEW_LINES;
		const moreBtn = container.createEl("button", {
			cls: "claude-agent-diff-show-more",
			text: `Show ${remaining} more lines`,
		});
		moreBtn.addEventListener("click", () => {
			moreBtn.remove();
			for (const line of lines.slice(MAX_PREVIEW_LINES)) {
				const lineEl = pre.createEl("div", { cls: "claude-agent-diff-line added" });
				lineEl.createSpan({ cls: "claude-agent-diff-prefix", text: "+" });
				lineEl.createSpan({ cls: "claude-agent-diff-text", text: line });
			}
		});
	}
}

interface DiffLine {
	type: "added" | "removed" | "unchanged";
	text: string;
}

/**
 * Simple line-by-line diff using longest common subsequence approach.
 * For performance, falls back to simple add/remove for very large inputs.
 */
function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	/* Fast path: one side is empty */
	if (oldLines.length === 0) {
		return newLines.map(text => ({ type: "added" as const, text }));
	}
	if (newLines.length === 0) {
		return oldLines.map(text => ({ type: "removed" as const, text }));
	}

	/* For very large diffs, use simple sequential approach */
	if (oldLines.length + newLines.length > 500) {
		return simpleDiff(oldLines, newLines);
	}

	/* Myers-like approach using LCS */
	const lcs = longestCommonSubsequence(oldLines, newLines);
	const result: DiffLine[] = [];
	let oi = 0, ni = 0, li = 0;

	while (oi < oldLines.length || ni < newLines.length) {
		const lcsLine = li < lcs.length ? lcs[li] : undefined;
		const oldLine = oi < oldLines.length ? oldLines[oi] : undefined;
		const newLine = ni < newLines.length ? newLines[ni] : undefined;

		if (lcsLine !== undefined && oldLine === lcsLine && newLine === lcsLine) {
			result.push({ type: "unchanged", text: lcsLine });
			oi++; ni++; li++;
		} else if (oldLine !== undefined && (lcsLine === undefined || oldLine !== lcsLine)) {
			result.push({ type: "removed", text: oldLine });
			oi++;
		} else if (newLine !== undefined) {
			result.push({ type: "added", text: newLine });
			ni++;
		} else {
			break;
		}
	}

	return result;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
	const m = a.length, n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				dp[i]![j] = dp[i - 1]![j - 1]! + 1;
			} else {
				dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
			}
		}
	}

	const result: string[] = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			result.unshift(a[i - 1]!);
			i--; j--;
		} else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
			i--;
		} else {
			j--;
		}
	}
	return result;
}

function simpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	const result: DiffLine[] = [];
	for (const line of oldLines) {
		result.push({ type: "removed", text: line });
	}
	for (const line of newLines) {
		result.push({ type: "added", text: line });
	}
	return result;
}
