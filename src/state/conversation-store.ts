import type { Plugin } from "obsidian";
import type { ConversationTab, Message, SavedConversationData } from "../types";
import { MAX_MESSAGES_PER_CONVERSATION } from "../constants";
import { EventBus } from "./event-bus";

const DATA_KEY = "conversations";

export class ConversationStore {
	private tabs: Map<string, ConversationTab> = new Map();
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly SAVE_DEBOUNCE_MS = 500;

	constructor(
		private readonly plugin: Plugin,
		private readonly eventBus: EventBus
	) {}

	async load(): Promise<SavedConversationData | null> {
		const allData = await this.plugin.loadData();
		if (!allData || !allData[DATA_KEY]) return null;

		const saved = allData[DATA_KEY] as SavedConversationData;
		this.tabs.clear();
		for (const tab of saved.tabs) {
			this.tabs.set(tab.id, tab);
		}
		return saved;
	}

	async save(): Promise<void> {
		const allData = (await this.plugin.loadData()) ?? {};
		const tabs = Array.from(this.tabs.values());
		allData[DATA_KEY] = {
			tabs,
			activeTabId: null,
		} satisfies SavedConversationData;
		await this.plugin.saveData(allData);
	}

	/** Debounced save — coalesces rapid writes (e.g. multiple messages in a stream). */
	private scheduleSave(): void {
		if (this.saveTimer !== null) {
			clearTimeout(this.saveTimer);
		}
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null;
			void this.save();
		}, ConversationStore.SAVE_DEBOUNCE_MS);
	}

	getTab(id: string): ConversationTab | undefined {
		return this.tabs.get(id);
	}

	getAllTabs(): ConversationTab[] {
		return Array.from(this.tabs.values()).sort((a, b) => b.updatedAt - a.updatedAt);
	}

	createTab(title?: string): ConversationTab {
		const tab: ConversationTab = {
			id: crypto.randomUUID(),
			title: title ?? "New conversation",
			status: "idle",
			messages: [],
			sessionId: undefined,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		this.tabs.set(tab.id, tab);
		this.eventBus.emit("tab:created", tab);
		void this.save();
		return tab;
	}

	deleteTab(id: string): void {
		this.tabs.delete(id);
		this.eventBus.emit("tab:closed", id);
		void this.save();
	}

	addMessage(tabId: string, message: Message): void {
		const tab = this.tabs.get(tabId);
		if (!tab) return;

		tab.messages.push(message);

		if (tab.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
			tab.messages = tab.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
		}

		tab.updatedAt = Date.now();
		this.eventBus.emit("conversation:message-added", { tabId, message });
		this.scheduleSave();
	}

	clearMessages(tabId: string): void {
		const tab = this.tabs.get(tabId);
		if (!tab) return;

		tab.messages = [];
		tab.sessionId = undefined;
		tab.updatedAt = Date.now();
		this.eventBus.emit("conversation:cleared", tabId);
		void this.save();
	}

	updateTitle(tabId: string, title: string): void {
		const tab = this.tabs.get(tabId);
		if (!tab) return;
		tab.title = title;
		tab.updatedAt = Date.now();
		this.eventBus.emit("tab:title-changed", { tabId, title });
		this.scheduleSave();
	}

	setSessionId(tabId: string, sessionId: string): void {
		const tab = this.tabs.get(tabId);
		if (tab) {
			/* Track previous session IDs for resume */
			if (tab.sessionId && tab.sessionId !== sessionId) {
				if (!tab.previousSessionIds) tab.previousSessionIds = [];
				tab.previousSessionIds.push(tab.sessionId);
				if (tab.previousSessionIds.length > 10) {
					tab.previousSessionIds = tab.previousSessionIds.slice(-10);
				}
			}
			tab.sessionId = sessionId;
		}
	}

	/**
	 * Remove the last `count` turns (user+assistant pairs) from a conversation.
	 * Resets sessionId so the next send starts a fresh session.
	 * Returns the number of turns actually removed.
	 */
	rewindMessages(tabId: string, count: number): number {
		const tab = this.tabs.get(tabId);
		if (!tab || tab.messages.length === 0 || count <= 0) return 0;

		let removed = 0;
		for (let i = 0; i < count; i++) {
			if (tab.messages.length === 0) break;

			/* Remove last assistant message */
			const lastMsg = tab.messages[tab.messages.length - 1];
			if (lastMsg && lastMsg.role === "assistant") {
				tab.messages.pop();
			}
			/* Remove preceding user message */
			const prevMsg = tab.messages.length > 0 ? tab.messages[tab.messages.length - 1] : undefined;
			if (prevMsg && prevMsg.role === "user") {
				tab.messages.pop();
			}
			removed++;
		}

		/* Reset session so next send starts fresh */
		tab.sessionId = undefined;
		tab.updatedAt = Date.now();
		void this.save();
		return removed;
	}

	/**
	 * Create a new tab from an existing set of messages (used by fork).
	 */
	createTabFromMessages(messages: Message[], title?: string, forkSource?: { sourceTabId: string; messageIndex: number }): ConversationTab {
		const tab: ConversationTab = {
			id: crypto.randomUUID(),
			title: title ?? "Forked conversation",
			status: "idle",
			messages: messages.map(m => ({ ...m })),
			sessionId: undefined,
			forkSource: forkSource,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		this.tabs.set(tab.id, tab);
		this.eventBus.emit("tab:created", tab);
		void this.save();
		return tab;
	}

	getSessionId(tabId: string): string | undefined {
		return this.tabs.get(tabId)?.sessionId;
	}
}
