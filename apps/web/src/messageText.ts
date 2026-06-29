import type { Message } from "@ciphera/types";

const LEGACY_MEDIA_TEXT = /^(voice|image|video|document):\s*/i;
const LEGACY_VOICE_FILE = /voice-note-.*\.webm/i;

export function shouldShowMessageText(message: Pick<Message, "attachments"> & { plaintext: string }) {
  const text = message.plaintext.trim();
  if (!text) return false;
  if (message.attachments.length === 0) return true;
  if (LEGACY_MEDIA_TEXT.test(text)) return false;
  if (LEGACY_VOICE_FILE.test(text)) return false;
  return true;
}