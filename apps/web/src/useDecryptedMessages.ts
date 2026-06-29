import { useEffect, useMemo, useState } from "react";
import type { Message } from "@ciphera/types";
import { decryptText, deriveConversationKeyCandidates } from "@ciphera/crypto";
import type { DecryptedMessage } from "./components/MessageBubble.tsx";

export function useDecryptedMessages(messages: Message[], identityKey: string) {
  const [items, setItems] = useState<DecryptedMessage[]>([]);

  useEffect(() => {
    let live = true;
    if (messages.length === 0) {
      setItems([]);
      return;
    }
    Promise.all(
      messages.map(async (message) => {
        const keys = await deriveConversationKeyCandidates(message.conversationId);
        return {
          ...message,
          plaintext: await decryptWithCandidates(message, keys)
        };
      })
    ).then((decrypted) => {
      if (live) setItems(decrypted);
    });
    return () => {
      live = false;
    };
  }, [messages, identityKey]);

  return useMemo(() => items, [items]);
}

async function decryptWithCandidates(message: Message, keys: string[]) {
  for (const key of keys) {
    try {
      return await decryptText(message.encryptedPayload, key);
    } catch {
      // Try the next key candidate.
    }
  }

  return "Unable to decrypt message";
}

