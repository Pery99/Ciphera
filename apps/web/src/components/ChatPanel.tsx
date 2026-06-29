import type { ChangeEvent, FormEvent, RefObject } from "react";
import { ArrowLeft, Image, Loader2, Mic, Send } from "lucide-react";
import type { Conversation, Message, UserProfile } from "@ciphera/types";
import { BitmojiAvatar } from "./BitmojiAvatar.tsx";
import { CipheraMascot } from "./CipheraMascot.tsx";
import { ComposerTextarea } from "./ComposerTextarea.tsx";
import { MessageBubble, type DecryptedMessage } from "./MessageBubble.tsx";
import { PendingAttachmentStrip, type PendingAttachment } from "./PendingAttachmentStrip.tsx";
import { ReplyComposer } from "./ReplyComposer.tsx";
import { getReplyBarPreview } from "../messagePreview.ts";
import { getMessageAuthorName, MessageStatusIcon } from "../messageStatus.tsx";

type ChatPanelProps = {
  mobileHidden: boolean;
  activeConversation: Conversation | null;
  activeMessages: Message[];
  decryptedMessages: DecryptedMessage[];
  sessionUser: UserProfile;
  isPeerTyping: boolean;
  messageById: Map<string, DecryptedMessage>;
  localAttachmentPreviews: Record<string, string>;
  pendingAttachments: PendingAttachment[];
  replyingTo: DecryptedMessage | null;
  draft: string;
  isRecording: boolean;
  messagePaneRef: RefObject<HTMLElement>;
  composerStackRef: RefObject<HTMLDivElement>;
  imageInputRef: RefObject<HTMLInputElement>;
  composerInputRef: RefObject<HTMLTextAreaElement>;
  onBack: () => void;
  onOpenMedia: (url: string, kind: "image" | "video") => void;
  onReply: (message: DecryptedMessage) => void;
  onCancelReply: () => void;
  onRemovePendingAttachment: (id: string) => void;
  onSubmit: (event: FormEvent) => void;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onDraftChange: (value: string) => void;
  onToggleRecording: () => void;
};

export function ChatPanel({
  mobileHidden,
  activeConversation,
  activeMessages,
  decryptedMessages,
  sessionUser,
  isPeerTyping,
  messageById,
  localAttachmentPreviews,
  pendingAttachments,
  replyingTo,
  draft,
  isRecording,
  messagePaneRef,
  composerStackRef,
  imageInputRef,
  composerInputRef,
  onBack,
  onOpenMedia,
  onReply,
  onCancelReply,
  onRemovePendingAttachment,
  onSubmit,
  onFilesSelected,
  onDraftChange,
  onToggleRecording
}: ChatPanelProps) {
  return (
    <section className={`chat-panel ${mobileHidden ? "mobile-hidden" : ""}`}>
      {activeConversation ? (
        <header className="chat-header">
          <button className="chat-back-btn mobile-only tap-spring" type="button" onClick={onBack} aria-label="Back to chats">
            <ArrowLeft size={22} />
          </button>
          <div className="peer-heading">
            <BitmojiAvatar user={activeConversation.peer} size={34} />
            <div className="peer-heading-copy">
              <h2>{activeConversation.peer.name}</h2>
              <span className={isPeerTyping ? "peer-status peer-status--typing" : "peer-status"}>
                {isPeerTyping ? (
                  <>
                    typing
                    <span className="typing-dots" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                  </>
                ) : (
                  `@${activeConversation.peer.username}`
                )}
              </span>
            </div>
          </div>
        </header>
      ) : (
        <header className="chat-header chat-header--placeholder desktop-only">
          <CipheraMascot size={40} />
          <div>
            <h2>Select a chat</h2>
            <span>Pick a conversation from your list</span>
          </div>
        </header>
      )}

      <section className="message-pane" ref={messagePaneRef}>
        {!activeConversation ? (
          <div className="empty-state">
            <CipheraMascot size={72} animated />
            <h3>No conversation selected</h3>
            <p>Create an invite link or search for a username to begin.</p>
          </div>
        ) : activeMessages.length > 0 && decryptedMessages.length === 0 ? (
          <div className="list-state">
            <Loader2 size={18} className="spin" /> Loading messages
          </div>
        ) : decryptedMessages.length === 0 ? (
          <div className="empty-state">
            <CipheraMascot size={72} animated />
            <h3>Start a private conversation</h3>
            <p>Send a text, attach encrypted media, or record a voice note.</p>
          </div>
        ) : (
          decryptedMessages.map((message) => {
            const isMine = message.senderId === sessionUser.id;
            const replyTarget = message.replyToId ? messageById.get(message.replyToId) ?? null : null;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={isMine}
                replyTo={replyTarget}
                replyAuthorName={
                  replyTarget
                    ? getMessageAuthorName(replyTarget, sessionUser.id, activeConversation?.peer ?? null)
                    : undefined
                }
                localAttachmentPreviews={localAttachmentPreviews}
                statusIcon={isMine ? <MessageStatusIcon status={message.status} /> : undefined}
                onOpenMedia={onOpenMedia}
                onReply={onReply}
              />
            );
          })
        )}
      </section>

      <div className="chat-composer-stack" ref={composerStackRef}>
        <PendingAttachmentStrip attachments={pendingAttachments} onRemove={onRemovePendingAttachment} />

        {activeConversation && replyingTo ? (
          <ReplyComposer
            authorName={getMessageAuthorName(replyingTo, sessionUser.id, activeConversation.peer)}
            preview={getReplyBarPreview(replyingTo)}
            onCancel={onCancelReply}
          />
        ) : null}

        {activeConversation ? (
          <form className="composer" onSubmit={onSubmit}>
            <input
              ref={imageInputRef}
              className="hidden-input"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={onFilesSelected}
            />
            <button type="button" className="icon-button" title="Attach image or video" onClick={() => imageInputRef.current?.click()}>
              <Image size={18} />
            </button>
            <ComposerTextarea
              ref={composerInputRef}
              value={draft}
              onChange={onDraftChange}
              placeholder={replyingTo ? "Write a reply..." : "Message"}
            />
            <button
              type="button"
              className={`icon-button ${isRecording ? "recording" : ""}`}
              title={isRecording ? "Stop recording" : "Record voice note"}
              onClick={onToggleRecording}
            >
              <Mic size={18} />
            </button>
            <button className="send-button tap-spring" type="submit" disabled={!draft.trim() && pendingAttachments.length === 0}>
              <Send size={17} />
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
