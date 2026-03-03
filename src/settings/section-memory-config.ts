import { Setting } from "obsidian";
import type ClaudeAgentPlugin from "../main";
import type { ConfigLayer } from "../types";
import type { SettingsResolver } from "./settings-resolver";
import {
	CONFIG_SCHEMA_KEYS,
	flattenSchemaKeys,
	findSchemaNode,
} from "./config-file-schema";
import { ConfigFileConfirmModal } from "./modals/config-file-confirm-modal";
import { MemoryPreviewModal } from "./modals/memory-preview-modal";
import { refreshSettingsTab, setNestedValue, parseValueBySchema, openFileInDefaultEditor } from "./memory-file-manager";

/* ── Main section ── */

export class SectionMemoryConfig {
	constructor(containerEl: HTMLElement, plugin: ClaudeAgentPlugin) {
		this.renderConfigSubdirSetting(containerEl, plugin);
		this.renderMemorySection(containerEl, plugin);
		this.renderConfigSection(containerEl, plugin);
	}

	private renderConfigSubdirSetting(containerEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		containerEl.createEl("h2", { text: "Custom config subdirectory" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "This path is used across all tabs for custom config, memory, agents, and other extensions.",
		});

		new Setting(containerEl)
			.setName("Subdirectory name")
			.setDesc("Subdirectory under the plugin folder (default: .agent)")
			.addText((text) => {
				text.setPlaceholder(".agent")
					.setValue(plugin.settings.agentConfigSubdir)
					.onChange(async (value) => {
						plugin.settings.agentConfigSubdir = value.trim() || ".agent";
						await plugin.saveSettings();
					});
			});
	}

	private renderMemorySection(containerEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		containerEl.createEl("h2", { text: "Memory" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Control which CLAUDE.md memory files the agent can access.",
		});

		const resolver = plugin.resolver;
		const configSubdir = plugin.settings.agentConfigSubdir || ".agent";

		/* ── User memory (read-only) ── */
		const userStatus = resolver?.getMemoryFileStatus("user", configSubdir);
		const userSetting = new Setting(containerEl)
			.setName("User memory")
			.setDesc("~/.claude/CLAUDE.md");

		if (userStatus) {
			userSetting.descEl.createSpan({
				text: userStatus.exists ? " · found" : " · not found",
				cls: `claude-agent-config-status ${userStatus.exists ? "is-found" : "is-missing"}`,
			});
			userSetting.descEl.createSpan({
				text: " · read-only",
				cls: "claude-agent-config-status is-readonly",
			});
		}

		if (userStatus?.exists && resolver) {
			userSetting.addExtraButton((btn) => {
				btn.setIcon("eye").setTooltip("Preview").onClick(() => {
					const content = resolver.readMemoryFile("user", configSubdir) ?? "";
					new MemoryPreviewModal(plugin.app, "User memory", content, userStatus.path).open();
				});
			});
		}

		userSetting.addToggle((toggle) => {
			toggle.setValue(plugin.settings.claudeSettingSources.userMemory).onChange(async (value) => {
				plugin.settings.claudeSettingSources.userMemory = value;
				await plugin.saveSettings();
			});
		});

		/* ── Project memory ── */
		const projectStatus = resolver?.getMemoryFileStatus("project", configSubdir);
		const projectSetting = new Setting(containerEl)
			.setName("Project memory")
			.setDesc("./CLAUDE.md");

		if (projectStatus) {
			projectSetting.descEl.createSpan({
				text: projectStatus.exists ? " · found" : " · not found",
				cls: `claude-agent-config-status ${projectStatus.exists ? "is-found" : "is-missing"}`,
			});
		}

		if (projectStatus?.exists && resolver) {
			projectSetting.addExtraButton((btn) => {
				btn.setIcon("eye").setTooltip("Preview").onClick(() => {
					const content = resolver.readMemoryFile("project", configSubdir) ?? "";
					new MemoryPreviewModal(plugin.app, "Project memory", content, projectStatus.path).open();
				});
			});
			projectSetting.addExtraButton((btn) => {
				btn.setIcon("pencil").setTooltip("Edit").onClick(() => {
					openFileInDefaultEditor(projectStatus.path);
				});
			});
		} else if (resolver) {
			projectSetting.addButton((btn) => {
				btn.setButtonText("Create").onClick(async () => {
					if (resolver.createMemoryFile("project", configSubdir)) {
						refreshSettingsTab(plugin);
					}
				});
			});
		}

		projectSetting.addToggle((toggle) => {
			toggle.setValue(plugin.settings.claudeSettingSources.projectMemory).onChange(async (value) => {
				plugin.settings.claudeSettingSources.projectMemory = value;
				await plugin.saveSettings();
			});
		});

		/* ── Custom memory ── */
		const customStatus = resolver?.getMemoryFileStatus("custom", configSubdir);
		const customSetting = new Setting(containerEl)
			.setName("Custom memory")
			.setDesc(`<plugin>/${configSubdir}/CLAUDE.md`);

		if (customStatus) {
			customSetting.descEl.createSpan({
				text: customStatus.exists ? " · found" : " · not found",
				cls: `claude-agent-config-status ${customStatus.exists ? "is-found" : "is-missing"}`,
			});
		}

		if (customStatus?.exists && resolver) {
			customSetting.addExtraButton((btn) => {
				btn.setIcon("eye").setTooltip("Preview").onClick(() => {
					const content = resolver.readMemoryFile("custom", configSubdir) ?? "";
					new MemoryPreviewModal(plugin.app, "Custom memory", content, customStatus.path).open();
				});
			});
			customSetting.addExtraButton((btn) => {
				btn.setIcon("pencil").setTooltip("Edit").onClick(() => {
					openFileInDefaultEditor(customStatus.path);
				});
			});
		} else if (resolver) {
			customSetting.addButton((btn) => {
				btn.setButtonText("Create").onClick(async () => {
					if (resolver.createMemoryFile("custom", configSubdir)) {
						refreshSettingsTab(plugin);
					}
				});
			});
		}

		customSetting.addToggle((toggle) => {
			toggle.setValue(plugin.settings.claudeSettingSources.customMemory).onChange(async (value) => {
				plugin.settings.claudeSettingSources.customMemory = value;
				await plugin.saveSettings();
			});
		});
	}

	private renderConfigSection(containerEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		containerEl.createEl("h2", { text: "Config files" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Layer configuration files override UI settings. Higher layers take priority (Custom > Project > User > UI).",
		});

		const resolver = plugin.resolver;
		if (!resolver) {
			containerEl.createEl("p", { text: "Resolver not initialized.", cls: "setting-item-description" });
			return;
		}

		const configSubdir = plugin.settings.agentConfigSubdir;

		/* ── User config layer ── */
		const userStatus = resolver.getConfigFileStatus("user", configSubdir);
		const userSetting = new Setting(containerEl)
			.setName("User config")
			.setDesc("~/.claude/settings.json");

		userSetting.descEl.createSpan({
			text: userStatus.exists ? " \u00b7 found" : " \u00b7 not found",
			cls: `claude-agent-config-status ${userStatus.exists ? "is-found" : "is-missing"}`,
		});
		userSetting.descEl.createSpan({
			text: " \u00b7 read-only",
			cls: "claude-agent-config-status is-readonly",
		});

		userSetting.addToggle((toggle) => {
			toggle.setValue(plugin.settings.configLayerToggles.userEnabled).onChange(async (value) => {
				plugin.settings.configLayerToggles.userEnabled = value;
				plugin.settings.claudeSettingSources.userSettings = value;
				await plugin.saveSettings();
			});
		});

		if (userStatus.exists && plugin.settings.configLayerToggles.userEnabled) {
			this.renderLayerDetails(containerEl, resolver, "user", configSubdir, plugin, true);
		}

		/* ── Project config layer ── */
		const projectStatus = resolver.getConfigFileStatus("project", configSubdir);
		const projectSetting = new Setting(containerEl)
			.setName("Project config")
			.setDesc("<vault>/.claude/settings.json");

		projectSetting.descEl.createSpan({
			text: projectStatus.exists ? " \u00b7 found" : " \u00b7 not found",
			cls: `claude-agent-config-status ${projectStatus.exists ? "is-found" : "is-missing"}`,
		});

		projectSetting.addToggle((toggle) => {
			toggle.setValue(plugin.settings.configLayerToggles.projectEnabled).onChange(async (value) => {
				plugin.settings.configLayerToggles.projectEnabled = value;
				plugin.settings.claudeSettingSources.projectSettings = value;
				await plugin.saveSettings();
			});
		});

		if (!projectStatus.exists) {
			projectSetting.addButton((btn) => {
				btn.setButtonText("Create").onClick(async () => {
					const modal = new ConfigFileConfirmModal(plugin.app, projectStatus.path, "Project");
					if (await modal.awaitResult()) {
						if (resolver.createConfigFile("project", configSubdir)) {
							plugin.reloadConfigFiles();
							refreshSettingsTab(plugin);
						}
					}
				});
			});
		}

		if (projectStatus.exists && plugin.settings.configLayerToggles.projectEnabled) {
			this.renderLayerDetails(containerEl, resolver, "project", configSubdir, plugin, false);
		}

		/* ── Custom config layer ── */
		const customStatus = resolver.getConfigFileStatus("custom", configSubdir);
		const customSetting = new Setting(containerEl)
			.setName("Custom config")
			.setDesc(`<plugin>/${configSubdir}/settings.json`);

		customSetting.descEl.createSpan({
			text: customStatus.exists ? " \u00b7 found" : " \u00b7 not found",
			cls: `claude-agent-config-status ${customStatus.exists ? "is-found" : "is-missing"}`,
		});

		customSetting.addToggle((toggle) => {
			toggle.setValue(plugin.settings.configLayerToggles.customEnabled).onChange(async (value) => {
				plugin.settings.configLayerToggles.customEnabled = value;
				await plugin.saveSettings();
			});
		});

		if (!customStatus.exists) {
			customSetting.addButton((btn) => {
				btn.setButtonText("Create").onClick(async () => {
					const modal = new ConfigFileConfirmModal(plugin.app, customStatus.path, "Custom");
					if (await modal.awaitResult()) {
						if (resolver.createConfigFile("custom", configSubdir)) {
							plugin.reloadConfigFiles();
							refreshSettingsTab(plugin);
						}
					}
				});
			});
		}

		if (customStatus.exists && plugin.settings.configLayerToggles.customEnabled) {
			this.renderLayerDetails(containerEl, resolver, "custom", configSubdir, plugin, false);
		}

		/* ── Reload button ── */
		new Setting(containerEl)
			.setName("Reload config files")
			.setDesc("Re-read all configuration files and recompute merged settings")
			.addButton((btn) => {
				btn.setButtonText("Reload").onClick(() => {
					plugin.reloadConfigFiles();
					refreshSettingsTab(plugin);
				});
			});

		/* ── Override details ── */
		const overrides = plugin.resolvedSettings.overrides;
		const overrideEntries = Object.entries(overrides) as [string, ConfigLayer][];

		if (overrideEntries.length > 0) {
			const detailsEl = containerEl.createEl("details", { cls: "claude-agent-collapsible" });
			detailsEl.createEl("summary", { text: `Override details (${overrideEntries.length} fields)` });

			const tableDiv = detailsEl.createDiv();
			const table = tableDiv.createEl("table", { cls: "claude-agent-override-table" });
			const thead = table.createEl("thead");
			const headerRow = thead.createEl("tr");
			headerRow.createEl("th", { text: "Field" });
			headerRow.createEl("th", { text: "Value" });
			headerRow.createEl("th", { text: "Source" });

			const tbody = table.createEl("tbody");
			const merged = plugin.resolvedSettings.merged;

			for (const [field, source] of overrideEntries) {
				const row = tbody.createEl("tr");
				row.createEl("td", { text: field, cls: "claude-agent-override-field" });
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const val = (merged as any)[field];
				const display = typeof val === "object" ? JSON.stringify(val).slice(0, 60) : String(val);
				row.createEl("td", { text: display, cls: "claude-agent-override-value" });
				const badgeEl = row.createEl("td");
				badgeEl.createSpan({ text: source, cls: `claude-agent-override-badge is-${source}` });
			}
		}

		/* ── View merged result ── */
		this.renderMergedView(containerEl, plugin);
	}

	/* ── Per-layer collapsible: shows parsed JSON + Add button ── */

	private renderLayerDetails(
		containerEl: HTMLElement,
		resolver: SettingsResolver,
		layer: "user" | "project" | "custom",
		configSubdir: string,
		plugin: ClaudeAgentPlugin,
		readonly: boolean,
	): void {
		const raw = resolver.readLayerRaw(layer, configSubdir);
		if (!raw) return;

		const detailsEl = containerEl.createEl("details", { cls: "claude-agent-collapsible claude-agent-layer-details" });
		const entryCount = Object.keys(raw).length;
		detailsEl.createEl("summary", {
			text: `${layer} config contents (${entryCount} ${entryCount === 1 ? "key" : "keys"})`,
		});

		const innerDiv = detailsEl.createDiv({ cls: "claude-agent-layer-inner" });

		/* ── View toggle (Table / Source) ── */
		const toggleBar = innerDiv.createDiv({ cls: "claude-agent-config-view-toggle" });
		const tableBtn = toggleBar.createEl("button", { text: "Table", cls: "is-active" });
		const sourceBtn = toggleBar.createEl("button", { text: "Source" });

		const tableView = innerDiv.createDiv({ cls: "claude-agent-config-table-view" });
		const sourceView = innerDiv.createDiv({ cls: "claude-agent-config-source-view" });
		sourceView.style.display = "none";

		/* Table view = existing tree rendering */
		if (entryCount === 0) {
			tableView.createEl("p", { text: "Empty config file.", cls: "claude-agent-config-empty" });
		} else {
			this.renderJsonTree(tableView, raw, "", layer, configSubdir, plugin, readonly);
		}

		/* Source view = raw JSON */
		const pre = sourceView.createEl("pre");
		pre.createEl("code", { text: JSON.stringify(raw, null, 2) });

		/* Toggle logic */
		tableBtn.addEventListener("click", () => {
			tableBtn.addClass("is-active");
			sourceBtn.removeClass("is-active");
			tableView.style.display = "";
			sourceView.style.display = "none";
		});
		sourceBtn.addEventListener("click", () => {
			sourceBtn.addClass("is-active");
			tableBtn.removeClass("is-active");
			sourceView.style.display = "";
			tableView.style.display = "none";
		});

		/* Add button (writable layers only) */
		if (!readonly && (layer === "project" || layer === "custom")) {
			const addRow = innerDiv.createDiv({ cls: "claude-agent-config-add-row" });
			this.renderAddForm(addRow, raw, layer, configSubdir, plugin);
		}
	}

	/** Render a JSON object as an indented key-value tree */
	private renderJsonTree(
		container: HTMLElement,
		obj: Record<string, unknown>,
		pathPrefix: string,
		layer: "user" | "project" | "custom",
		configSubdir: string,
		plugin: ClaudeAgentPlugin,
		readonly: boolean,
		depth = 0,
	): void {
		for (const [key, value] of Object.entries(obj)) {
			const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
			const row = container.createDiv({ cls: "claude-agent-config-kv-row" });
			row.style.paddingLeft = `${depth * 16}px`;

			const keyEl = row.createSpan({ text: key, cls: "claude-agent-config-key" });

			const schemaNode = findSchemaNode(fullPath);
			if (schemaNode) {
				keyEl.title = `Type: ${schemaNode.type}${schemaNode.enumValues ? ` [${schemaNode.enumValues.join(", ")}]` : ""}`;
			}

			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				row.createSpan({ text: " {}", cls: "claude-agent-config-type-hint" });

				/* Delete button for writable objects */
				if (!readonly) {
					const delBtn = row.createEl("button", { text: "\u00d7", cls: "claude-agent-config-del-btn" });
					delBtn.title = `Remove "${fullPath}"`;
					delBtn.addEventListener("click", () => {
						this.deleteKeyFromLayer(fullPath, layer, configSubdir, plugin);
					});
				}

				this.renderJsonTree(
					container, value as Record<string, unknown>,
					fullPath, layer, configSubdir, plugin, readonly, depth + 1,
				);
			} else {
				const valDisplay = Array.isArray(value) ? JSON.stringify(value) : String(value);
				row.createSpan({ text: ": ", cls: "claude-agent-config-sep" });
				row.createSpan({ text: valDisplay, cls: "claude-agent-config-value" });

				if (!readonly) {
					const delBtn = row.createEl("button", { text: "\u00d7", cls: "claude-agent-config-del-btn" });
					delBtn.title = `Remove "${fullPath}"`;
					delBtn.addEventListener("click", () => {
						this.deleteKeyFromLayer(fullPath, layer, configSubdir, plugin);
					});
				}
			}
		}
	}

	/** Add form with key autocomplete from schema */
	private renderAddForm(
		container: HTMLElement,
		currentData: Record<string, unknown>,
		layer: "project" | "custom",
		configSubdir: string,
		plugin: ClaudeAgentPlugin,
	): void {
		const form = container.createDiv({ cls: "claude-agent-config-add-form" });

		const keyWrapper = form.createDiv({ cls: "claude-agent-config-add-key-wrapper" });
		const keyInput = keyWrapper.createEl("input", {
			type: "text",
			placeholder: "Key (e.g. model, sdkToolToggles.Read)",
			cls: "claude-agent-config-add-input claude-agent-config-add-key",
		});

		/* Autocomplete dropdown */
		const allKeys = flattenSchemaKeys(CONFIG_SCHEMA_KEYS);
		const existingKeys = new Set(Object.keys(currentData));
		const suggestableKeys = allKeys.filter((k) => !existingKeys.has(k.split(".")[0]!) || k.includes("."));
		const dropdown = keyWrapper.createDiv({ cls: "claude-agent-config-autocomplete" });
		dropdown.style.display = "none";

		const renderSuggestions = (filter: string) => {
			dropdown.empty();
			const matches = filter
				? suggestableKeys.filter((k) => k.toLowerCase().startsWith(filter.toLowerCase()))
				: suggestableKeys.slice(0, 15);

			if (matches.length === 0) {
				dropdown.style.display = "none";
				return;
			}

			dropdown.style.display = "block";
			for (const match of matches.slice(0, 12)) {
				const node = findSchemaNode(match);
				const item = dropdown.createDiv({ cls: "claude-agent-config-autocomplete-item" });
				item.createSpan({ text: match });
				if (node) {
					item.createSpan({ text: ` (${node.type})`, cls: "claude-agent-config-type-hint" });
				}
				item.addEventListener("mousedown", (e) => {
					e.preventDefault(); // prevent blur from firing before selection
					keyInput.value = match;
					dropdown.style.display = "none";
					/* Auto-set placeholder for value based on type */
					if (node) {
						if (node.enumValues) {
							valueInput.placeholder = node.enumValues.join(" | ");
						} else if (node.type === "boolean") {
							valueInput.placeholder = "true | false";
						} else if (node.type === "number") {
							valueInput.placeholder = "number";
						} else if (node.type === "array") {
							valueInput.placeholder = '["item1", "item2"]';
						} else if (node.type === "object") {
							valueInput.placeholder = '{"key": "value"}';
						} else {
							valueInput.placeholder = "value";
						}
					}
					valueInput.focus();
				});
			}
		};

		keyInput.addEventListener("input", () => renderSuggestions(keyInput.value));
		keyInput.addEventListener("focus", () => renderSuggestions(keyInput.value));
		keyInput.addEventListener("blur", () => {
			dropdown.style.display = "none";
		});

		const valueInput = form.createEl("input", {
			type: "text",
			placeholder: "Value",
			cls: "claude-agent-config-add-input claude-agent-config-add-value",
		});

		const addBtn = form.createEl("button", { text: "Add", cls: "claude-agent-config-add-btn" });
		addBtn.addEventListener("click", () => {
			const key = keyInput.value.trim();
			const valStr = valueInput.value.trim();
			if (!key || !valStr) return;

			const schemaNode = findSchemaNode(key);
			const parsedValue = parseValueBySchema(valStr, schemaNode);

			const resolver = plugin.resolver;
			if (!resolver) return;

			const data = resolver.readLayerRaw(layer, configSubdir) ?? {};
			setNestedValue(data, key, parsedValue);

			if (resolver.writeLayerConfig(layer, data, configSubdir)) {
				plugin.reloadConfigFiles();
				refreshSettingsTab(plugin);
			}
		});
	}

	/** Delete a key from a layer config file */
	private deleteKeyFromLayer(
		keyPath: string,
		layer: "user" | "project" | "custom",
		configSubdir: string,
		plugin: ClaudeAgentPlugin,
	): void {
		if (layer === "user") return; // read-only

		const resolver = plugin.resolver;
		if (!resolver) return;

		const data = resolver.readLayerRaw(layer, configSubdir);
		if (!data) return;

		const parts = keyPath.split(".");
		if (parts.length === 1) {
			delete data[parts[0]!];
		} else {
			let current: Record<string, unknown> = data;
			for (let i = 0; i < parts.length - 1; i++) {
				const next = current[parts[i]!];
				if (typeof next !== "object" || next === null) return;
				current = next as Record<string, unknown>;
			}
			delete current[parts[parts.length - 1]!];
		}

		if (resolver.writeLayerConfig(layer as "project" | "custom", data, configSubdir)) {
			plugin.reloadConfigFiles();
			refreshSettingsTab(plugin);
		}
	}

	/* ── Merged result view (hidden by default) ── */

	private renderMergedView(containerEl: HTMLElement, plugin: ClaudeAgentPlugin): void {
		const detailsEl = containerEl.createEl("details", { cls: "claude-agent-collapsible" });
		detailsEl.createEl("summary", { text: "View merged settings" });

		const inner = detailsEl.createDiv({ cls: "claude-agent-merged-view" });
		const merged = plugin.resolvedSettings.merged;
		const overrides = plugin.resolvedSettings.overrides;

		/* Render as formatted JSON with source badges */
		const pre = inner.createEl("pre", { cls: "claude-agent-merged-json" });

		const lines: string[] = [];
		const mergedObj = merged as unknown as Record<string, unknown>;
		const keys = Object.keys(mergedObj).sort();

		for (const key of keys) {
			const val = mergedObj[key];
			const source = (overrides as Record<string, string>)[key];
			const valStr = typeof val === "object" ? JSON.stringify(val, null, 2) : JSON.stringify(val);

			if (source) {
				lines.push(`"${key}": ${valStr}  /* [${source}] */`);
			} else {
				lines.push(`"${key}": ${valStr}`);
			}
		}

		pre.textContent = "{\n  " + lines.join(",\n  ") + "\n}";
	}
}
