import { TFile } from "obsidian";
import type { App, Plugin } from "obsidian";
import type { VaultFileEntry } from "../types";

const INDEXABLE_EXTENSIONS = new Set(["md", "txt", "json", "yaml", "yml", "csv", "js", "ts", "css", "html"]);

export class VaultFileCache {
	private entries = new Map<string, VaultFileEntry>();
	private folderSet = new Set<string>();

	constructor(private readonly app: App) {}

	async buildIndex(): Promise<void> {
		this.entries.clear();
		this.folderSet.clear();

		const files = this.app.vault.getFiles();
		for (const file of files) {
			if (!INDEXABLE_EXTENSIONS.has(file.extension)) continue;
			this.entries.set(file.path, {
				path: file.path,
				basename: file.basename,
				extension: file.extension,
			});
			/* Track parent folders */
			const parts = file.path.split("/");
			for (let i = 1; i < parts.length; i++) {
				this.folderSet.add(parts.slice(0, i).join("/"));
			}
		}
	}

	search(query: string, limit = 20): VaultFileEntry[] {
		if (!query) return [];
		const lower = query.toLowerCase();
		const scored: { entry: VaultFileEntry; score: number }[] = [];

		for (const entry of this.entries.values()) {
			const baseLower = entry.basename.toLowerCase();
			const pathLower = entry.path.toLowerCase();

			let score = 0;
			if (baseLower === lower) {
				score = 100;
			} else if (baseLower.startsWith(lower)) {
				score = 80;
			} else if (baseLower.includes(lower)) {
				score = 60;
			} else if (pathLower.includes(lower)) {
				score = 40;
			}

			if (score > 0) {
				scored.push({ entry, score });
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, limit).map(s => s.entry);
	}

	searchFolders(query: string, limit = 10): string[] {
		if (!query) return [];
		const lower = query.toLowerCase();
		const results: { path: string; score: number }[] = [];

		for (const folder of this.folderSet) {
			const folderLower = folder.toLowerCase();
			const name = folder.split("/").pop() ?? folder;
			const nameLower = name.toLowerCase();

			let score = 0;
			if (nameLower === lower) score = 100;
			else if (nameLower.startsWith(lower)) score = 80;
			else if (nameLower.includes(lower)) score = 60;
			else if (folderLower.includes(lower)) score = 40;

			if (score > 0) results.push({ path: folder, score });
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, limit).map(r => r.path);
	}

	getAll(): VaultFileEntry[] {
		return Array.from(this.entries.values());
	}

	registerEvents(plugin: Plugin): void {
		plugin.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && INDEXABLE_EXTENSIONS.has(file.extension)) {
					this.entries.set(file.path, { path: file.path, basename: file.basename, extension: file.extension });
					this.updateFolders(file.path);
				}
			})
		);

		plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.entries.delete(file.path);
			})
		);

		plugin.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.entries.delete(oldPath);
				if (file instanceof TFile && INDEXABLE_EXTENSIONS.has(file.extension)) {
					this.entries.set(file.path, { path: file.path, basename: file.basename, extension: file.extension });
					this.updateFolders(file.path);
				}
			})
		);
	}

	private updateFolders(filePath: string): void {
		const parts = filePath.split("/");
		for (let i = 1; i < parts.length; i++) {
			this.folderSet.add(parts.slice(0, i).join("/"));
		}
	}

	destroy(): void {
		this.entries.clear();
		this.folderSet.clear();
	}
}
