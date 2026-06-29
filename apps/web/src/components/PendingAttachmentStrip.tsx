import { Trash2 } from "lucide-react";
import { VoiceNotePlayer } from "./VoiceNotePlayer.tsx";

export type PendingAttachment = {
  id: string;
  file: File;
  kind: "image" | "video" | "document" | "voice";
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  previewUrl?: string;
};

type PendingAttachmentStripProps = {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
};

export function PendingAttachmentStrip({ attachments, onRemove }: PendingAttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="pending-attachments">
      {attachments.map((attachment) => (
        <div className="pending-attachment" key={attachment.id}>
          {attachment.kind === "image" && attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt={attachment.name} className="pending-attachment-thumb" />
          ) : attachment.kind === "video" && attachment.previewUrl ? (
            <video src={attachment.previewUrl} className="pending-attachment-thumb" muted playsInline />
          ) : attachment.kind === "voice" && attachment.previewUrl ? (
            <div className="pending-attachment-voice-wrap">
              <VoiceNotePlayer src={attachment.previewUrl} durationMs={attachment.durationMs} tone="theirs" />
            </div>
          ) : (
            <div className="pending-attachment-file">{attachment.name}</div>
          )}
          <button
            type="button"
            className="pending-attachment-remove tap-spring"
            title="Remove"
            onClick={() => onRemove(attachment.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}