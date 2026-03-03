import type { ConversationStore } from "../state/conversation-store";
import type { TabManager } from "../state/tab-manager";
import type { EventBus } from "../state/event-bus";

export class ConversationFork {
	constructor(
		private readonly store: ConversationStore,
		private readonly tabManager: TabManager,
		private readonly eventBus: EventBus,
	) {}

	/**
	 * Fork a conversation from a specific assistant message.
	 * @param sourceTabId - The tab to fork from
	 * @param messageIndex - The index of the assistant message to fork from (inclusive)
	 * @param target - "new_tab" creates a new tab; "current_tab" truncates in place
	 * @returns The new tab ID (for new_tab) or the same tab ID (for current_tab), or null on failure
	 */
	forkFromMessage(
		sourceTabId: string,
		messageIndex: number,
		target: "new_tab" | "current_tab",
	): string | null {
		const sourceTab = this.store.getTab(sourceTabId);
		if (!sourceTab) return null;

		/* Include messages up to and including the specified index */
		const messages = sourceTab.messages.slice(0, messageIndex + 1);
		if (messages.length === 0) return null;

		if (target === "new_tab") {
			const title = sourceTab.title.startsWith("Fork:")
				? sourceTab.title
				: `Fork: ${sourceTab.title}`;

			const newTab = this.store.createTabFromMessages(
				messages,
				title,
				{ sourceTabId, messageIndex },
			);

			this.tabManager.setActiveTab(newTab.id);
			this.eventBus.emit("conversation:forked", {
				sourceTabId,
				newTabId: newTab.id,
			});

			return newTab.id;
		} else {
			/* current_tab: truncate messages in place */
			sourceTab.messages = messages.map(m => ({ ...m }));
			sourceTab.sessionId = undefined;
			sourceTab.updatedAt = Date.now();
			void this.store.save();

			this.eventBus.emit("conversation:forked", {
				sourceTabId,
				newTabId: sourceTabId,
			});

			return sourceTabId;
		}
	}
}
