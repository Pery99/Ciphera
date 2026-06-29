import { Check, CheckCheck, Square } from "lucide-react";
import type { Message, UserProfile } from "@ciphera/types";

export function getMessageAuthorName(message: Message, selfId: string, peer: UserProfile | null) {
  if (message.senderId === selfId) return "You";
  return peer?.name ?? "Them";
}

export function MessageStatusIcon({ status }: { status: Message["status"] }) {
  if (status === "queued") return <Square size={13} className="queued" />;
  if (status === "sent") return <Check size={15} />;
  return <CheckCheck size={15} className={status === "read" ? "read" : ""} />;
}
