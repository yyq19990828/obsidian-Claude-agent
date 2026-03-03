import process from "process";
import type { ClaudeAgentSettings } from "../types";
import { buildPermissionMode, buildCanUseToolCallback } from "./tool-permission";
import type { ToolCall } from "../types";
import type { buildVaultMcpServer } from "./vault-tools";

export function buildEnv(settings: ClaudeAgentSettings): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = {
		...process.env,
		...settings.envVars,
	};

	if (settings.authMethod === "api_key" && settings.apiKey.trim()) {
		env.ANTHROPIC_API_KEY = settings.apiKey.trim();
	}

	return env;
}

export function buildSettingSources(settings: ClaudeAgentSettings): ("user" | "project" | "local")[] | undefined {
	if (settings.safeMode) {
		return undefined;
	}
	const sources: ("user" | "project" | "local")[] = [];
	const cs = settings.claudeSettingSources;
	if (cs.projectSettings || cs.projectMemory) {
		sources.push("project", "local");
	}
	if (cs.userSettings || cs.userMemory) {
		sources.push("user");
	}
	return sources.length > 0 ? sources : undefined;
}

interface OptionsCacheInput {
	allowedTools: string[];
	disallowedTools: string[];
	availableTools: string[] | undefined;
	claudeExecutablePath: string | undefined;
	vaultServer: ReturnType<typeof buildVaultMcpServer> | null;
	agents: Record<string, unknown> | undefined;
}

export function buildSdkOptions(
	settings: ClaudeAgentSettings,
	cache: OptionsCacheInput,
	cwd: string,
	sessionId: string | undefined,
	abortController: AbortController,
	requestToolApproval: (toolCall: ToolCall) => Promise<boolean>,
): Record<string, unknown> {
	const env = buildEnv(settings);
	const settingSources = buildSettingSources(settings);
	const permMode = buildPermissionMode(settings);
	const canUseTool = buildCanUseToolCallback(settings, requestToolApproval);

	const mcpServers: Record<string, ReturnType<typeof buildVaultMcpServer> & object> = {};
	if (cache.vaultServer) {
		mcpServers["obsidian-vault"] = cache.vaultServer;
	}

	return {
		cwd,
		model: settings.model,
		includePartialMessages: true,
		resume: sessionId,
		abortController,
		env,
		mcpServers,
		allowedTools: cache.allowedTools,
		...(cache.disallowedTools.length > 0 ? { disallowedTools: cache.disallowedTools } : {}),
		...(cache.availableTools !== undefined ? { tools: cache.availableTools } : {}),
		permissionMode: permMode,
		/* Only enable dangerouslySkipPermissions when truly bypassing.
		   In CLI subprocess, this flag takes highest priority and overrides
		   permissionMode to "bypassPermissions", breaking canUseTool routing. */
		...(permMode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {}),
		canUseTool,
		...(settingSources ? { settingSources } : {}),
		...(cache.claudeExecutablePath ? { pathToClaudeCodeExecutable: cache.claudeExecutablePath } : {}),
		...(cache.agents ? { agents: cache.agents } : {}),
	};
}
