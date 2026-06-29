import type { Message } from "@ciphera/types";
import { shouldShowMessageText } from "./messageText.ts";

const ATTACHMENT_LABELS: Record<Message["attachments"][number]["kind"], string> = {
  image: "Photo",
  video: "Video",
  voice: "Voice message",
  document: "Document"
};

export function collapsePreviewText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function getMessagePreview(message: Pick<Message, "attachments"> & { plaintext: string }): string {
  if (message.attachments.length > 0) {
    const kinds = [...new Set(message.attachments.map((attachment) => attachment.kind))];
    if (kinds.length === 1) return ATTACHMENT_LABELS[kinds[0]];
    return `${message.attachments.length} attachments`;
  }

  const text = collapsePreviewText(message.plaintext);
  if (!text || !shouldShowMessageText(message)) return "Message";

  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

export function getReplyBarPreview(message: Pick<Message, "attachments"> & { plaintext: string }): string {
  if (message.attachments.length > 0) return getMessagePreview(message);

  const text = collapsePreviewText(message.plaintext);
  if (!text || !shouldShowMessageText(message)) return "Message";

  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export function getQuotedReplyPreview(message: Pick<Message, "attachments"> & { plaintext: string }): string {
  if (message.attachments.length > 0) return getMessagePreview(message);

  const text = collapsePreviewText(message.plaintext);
  if (!text || !shouldShowMessageText(message)) return "Message";

  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}