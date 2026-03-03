import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "process";
import type { ClaudeAgentSettings } from "../types";

export function resolveClaudeExecutablePath(settings: ClaudeAgentSettings): string | undefined {
	if (settings.claudeCliPath && existsSync(settings.claudeCliPath)) {
		return settings.claudeCliPath;
	}

	const envPath = process.env.CLAUDE_CODE_PATH;
	if (envPath && existsSync(envPath)) {
		return envPath;
	}

	const envCandidates = (process.env.PATH ?? "")
		.split(path.delimiter)
		.filter(Boolean)
		.map((segment) => path.join(segment, "claude"));
	for (const candidate of envCandidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	const home = process.env.HOME ?? "";
	const commonCandidates = [
		home ? path.join(home, ".local/bin/claude") : "",
		"/usr/local/bin/claude",
		"/usr/bin/claude",
		"/opt/homebrew/bin/claude",
	].filter(Boolean);

	for (const candidate of commonCandidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	try {
		const resolved = execFileSync("which", ["claude"], { encoding: "utf8" }).trim();
		if (resolved && existsSync(resolved)) {
			return resolved;
		}
	} catch {
		// Fall back to SDK built-in executable resolution.
	}

	return undefined;
}
