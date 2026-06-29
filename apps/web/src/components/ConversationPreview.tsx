import { useEffect, useState } from "react";
import type { Conversation, Message } from "@ciphera/types";
import { decryptText, deriveConversationKeyCandidates } from "@ciphera/crypto";
import { shouldShowMessageText } from "../messageText.ts";

type ConversationPreviewProps = {
  conversation: Conversation;
  messages: Record<string, Message[]>;
  identityKey: string;
  unread?: boolean;
};

export function ConversationPreview({ conversation, messages, identityKey, unread = false }: ConversationPreviewProps) {
  const [preview, setPreview] = useState("No messages yet");

  useEffect(() => {
    let live = true;
    const last = messages[conversation.id]?.at(-1) ?? conversation.lastMessage;
    if (!last) {
      setPreview("No messages yet");
      return;
    }
    deriveConversationKeyCandidates(conversation.id)
      .then((keys) => decryptWithCandidates(last, keys))
      .then((plaintext) => {
        if (!live) return;
        const previewSource = { plaintext, attachments: last.attachments };
        if (!shouldShowMessageText(previewSource)) {
          const kind = last.attachments[0]?.kind;
          setPreview(kind === "voice" ? "Voice note" : kind === "image" ? "Photo" : kind === "video" ? "Video" : "Attachment");
          return;
        }
        const trimmed = plaintext.trim();
        setPreview(trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed || "Encrypted message");
      })
      .catch(() => {
        if (live) setPreview("Encrypted message");
      });

    return () => {
      live = false;
    };
  }, [conversation.id, conversation.lastMessage, identityKey, messages]);

  return <small className={unread ? "conversation-preview conversation-preview--unread" : "conversation-preview"}>{preview}</small>;
}

async function decryptWithCandidates(message: Message, keys: string[]) {
  let lastError: unknown;
  for (const key of keys) {
    try {
      return await decryptText(message.encryptedPayload, key);
    } catch (caught) {
      lastError = caught;
    }
  }
  throw lastError ?? new Error("Unable to decrypt message.");
}
