import { X } from "lucide-react";
import { tapHaptic } from "../haptics.ts";

type ReplyComposerProps = {
  authorName: string;
  preview: string;
  onCancel: () => void;
};

export function ReplyComposer({ authorName, preview, onCancel }: ReplyComposerProps) {
  return (
    <div className="reply-composer">
      <div className="reply-composer-accent" aria-hidden />
      <div className="reply-composer-body">
        <strong className="reply-composer-author">Replying to {authorName}</strong>
        <span className="reply-composer-preview">{preview}</span>
      </div>
      <button
        type="button"
        className="reply-composer-close tap-spring"
        onClick={() => {
          tapHaptic();
          onCancel();
        }}
        aria-label="Cancel reply"
      >
        <X size={18} />
      </button>
    </div>
  );
}