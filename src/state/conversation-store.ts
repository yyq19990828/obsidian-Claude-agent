import type { Plugin } from "obsidian";
import type { ConversationTab, Message, SavedConversationData } from "../types";
import { MAX_MESSAGES_PER_CONVERSATION } from "../constants";
import { EventBus } from "./event-bus";

const DATA_KEY = "conversations";

export class ConversationStore {
	private tabs: Map<string, ConversationTab> = new Map();

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
		void this.save();
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
		void this.save();
	}

	setSessionId(tabId: string, sessionId: string): void {
		const tab = this.tabs.get(tabId);
		if (tab) {
			tab.sessionId = sessionId;
		}
	}

	getSessionId(tabId: string): string | undefined {
		return this.tabs.get(tabId)?.sessionId;
	}
}
