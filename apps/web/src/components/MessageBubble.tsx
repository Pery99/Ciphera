import { useRef, useState } from "react";
import { CornerUpLeft, MoreVertical } from "lucide-react";
import type { Message } from "@ciphera/types";
import { AttachmentBubble } from "./AttachmentBubble.tsx";
import { shouldShowMessageText } from "../messageText.ts";
import { getQuotedReplyPreview } from "../messagePreview.ts";
import { tapHaptic } from "../haptics.ts";
import { useSwipeToReply } from "../useSwipeToReply.ts";
import { MessageActionMenu } from "./MessageActionMenu.tsx";

export type DecryptedMessage = Message & { plaintext: string };

type MessageBubbleProps = {
  message: DecryptedMessage;
  isMine: boolean;
  replyTo?: DecryptedMessage | null;
  replyAuthorName?: string;
  localAttachmentPreviews: Record<string, string>;
  statusIcon?: React.ReactNode;
  onOpenMedia: (url: string, kind: "image" | "video") => void;
  onReply: (message: DecryptedMessage) => void;
};

export function MessageBubble({
  message,
  isMine,
  replyTo,
  replyAuthorName,
  localAttachmentPreviews,
  statusIcon,
  onOpenMedia,
  onReply
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  const swipe = useSwipeToReply(() => {
    onReply(message);
    setMenuOpen(false);
  });

  function handleReply() {
    tapHaptic();
    onReply(message);
    setMenuOpen(false);
  }

  const isVoiceOnly =
    message.attachments.length === 1 &&
    message.attachments[0].kind === "voice" &&
    !shouldShowMessageText(message);

  return (
    <div className={`bubble-row ${isMine ? "mine" : "theirs"}`}>
      <div
        ref={swipe.zoneRef}
        className={`bubble-swipe-zone ${swipe.isDragging ? "bubble-swipe-zone--dragging" : ""} ${swipe.justTriggered ? "bubble-swipe-zone--triggered" : ""}`}
        {...swipe.handlers}
      >
        <div
          className={`bubble-swipe-reply-hint ${swipe.ready ? "bubble-swipe-reply-hint--ready" : ""}`}
          style={{
            opacity: swipe.justTriggered ? 1 : swipe.progress,
            ["--reply-scale" as string]: swipe.justTriggered ? 1 : 0.55 + swipe.progress * 0.45
          }}
          aria-hidden
        >
          <CornerUpLeft size={18} strokeWidth={2.4} />
        </div>

        <article
          className={`bubble bubble-swipeable ${isMine ? "mine" : "theirs"} ${message.attachments.length > 0 ? "bubble--media" : ""} ${isVoiceOnly ? "bubble--voice" : ""} ${swipe.isDragging ? "bubble-swipeable--dragging" : ""}`}
          style={{ transform: `translate3d(${swipe.offset}px, 0, 0)` }}
          onClickCapture={swipe.onClickCapture}
        >
          {replyTo && replyAuthorName ? (
            <div className={`bubble-reply-quote ${isMine ? "bubble-reply-quote--mine" : "bubble-reply-quote--theirs"}`}>
              <strong>{replyAuthorName}</strong>
              <span>{getQuotedReplyPreview(replyTo)}</span>
            </div>
          ) : null}

          {message.attachments.map((attachment) => (
            <AttachmentBubble
              attachment={attachment}
              conversationId={message.conversationId}
              localPreviewUrl={localAttachmentPreviews[attachment.id]}
              isSending={message.status === "queued"}
              tone={isMine ? "mine" : "theirs"}
              key={attachment.id}
              onOpen={onOpenMedia}
            />
          ))}
          {shouldShowMessageText(message) ? <p>{message.plaintext}</p> : null}
          <footer>
            <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {isMine && statusIcon}
          </footer>
        </article>
      </div>

      <div className="bubble-actions">
        <button
          ref={menuBtnRef}
          type="button"
          className={`bubble-menu-btn tap-spring ${menuOpen ? "bubble-menu-btn--open" : ""}`}
          onClick={() => {
            tapHaptic();
            setMenuOpen((value) => !value);
          }}
          aria-label="Message options"
          aria-expanded={menuOpen}
        >
          <MoreVertical size={18} />
        </button>
        <MessageActionMenu
          open={menuOpen}
          anchorRef={menuBtnRef}
          align={isMine ? "end" : "start"}
          onReply={handleReply}
          onClose={() => setMenuOpen(false)}
        />
      </div>
    </div>
  );
}