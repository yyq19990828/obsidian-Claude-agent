import { App, TFile } from "obsidian";
import { NoteContext } from "../types";

export class ContextService {
	static async captureActiveNoteContext(app: App, maxSize: number): Promise<NoteContext | null> {
		const activeFile = app.workspace.getActiveFile();
		if (!(activeFile instanceof TFile) || activeFile.extension !== "md") {
			return null;
		}

		const fullContent = await app.vault.read(activeFile);
		if (fullContent.length <= maxSize) {
			return {
				path: activeFile.path,
				content: fullContent,
				truncated: false,
			};
		}

		return {
			path: activeFile.path,
			content: fullContent.slice(0, maxSize),
			truncated: true,
		};
	}
}
