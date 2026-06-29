import type { PendingAttachment } from "./components/PendingAttachmentStrip.tsx";

export function kindFromFile(file: File): PendingAttachment["kind"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
