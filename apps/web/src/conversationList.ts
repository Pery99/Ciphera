import type { Conversation, Message } from "@ciphera/types";

export function sortConversationsByRecent(items: Conversation[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.lastMessage?.createdAt ?? left.updatedAt;
    const rightTime = right.lastMessage?.createdAt ?? right.updatedAt;
    return rightTime.localeCompare(leftTime);
  });
}

export function shouldIncrementUnread(options: {
  conversationId: string;
  senderId: string;
  selfId: string;
  activeConversationId: string;
  mobileView: "home" | "chat";
}) {
  if (options.senderId === options.selfId) return false;
  if (options.mobileView === "chat" && options.conversationId === options.activeConversationId) return false;
  return true;
}

export function applyIncomingMessage(
  conversations: Conversation[],
  message: Message,
  options: {
    selfId: string;
    activeConversationId: string;
    mobileView: "home" | "chat";
  }
): Conversation[] {
  const index = conversations.findIndex((conversation) => conversation.id === message.conversationId);
  if (index < 0) return conversations;

  const current = conversations[index];
  const incrementUnread = shouldIncrementUnread({
    conversationId: message.conversationId,
    senderId: message.senderId,
    selfId: options.selfId,
    activeConversationId: options.activeConversationId,
    mobileView: options.mobileView
  });

  const updated: Conversation = {
    ...current,
    lastMessage: message,
    updatedAt: message.createdAt,
    unreadCount: incrementUnread ? current.unreadCount + 1 : current.unreadCount
  };

  const next = [...conversations];
  next.splice(index, 1);
  next.unshift(updated);
  return next;
}

export function clearConversationUnread(conversations: Conversation[], conversationId: string) {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
  );
}

export function formatUnreadCount(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

export function mergeMessages(existing: Message[], incoming: Message[]) {
  const byId = new Map<string, Message>();
  for (const message of [...existing, ...incoming]) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}