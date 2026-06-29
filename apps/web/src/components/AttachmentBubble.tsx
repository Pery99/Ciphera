import { useEffect, useState } from "react";
import { Loader2, Maximize2, Paperclip } from "lucide-react";
import { VoiceNotePlayer } from "./VoiceNotePlayer.tsx";
import { MediaLoadingShell } from "./MediaLoadingShell.tsx";
import type { Message } from "@ciphera/types";
import { deriveConversationKeyCandidates, importAesKey } from "@ciphera/crypto";

type AttachmentBubbleProps = {
  attachment: Message["attachments"][number];
  conversationId: string;
  localPreviewUrl?: string;
  isSending?: boolean;
  tone?: "mine" | "theirs";
  onOpen: (url: string, kind: "image" | "video") => void;
};

export function AttachmentBubble({
  attachment,
  conversationId,
  localPreviewUrl,
  isSending = false,
  tone = "theirs",
  onOpen
}: AttachmentBubbleProps) {
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [error, setError] = useState("");
  const isPending = attachment.encryptedResourceRef.startsWith("pending://");
  const isUploading = isSending || isPending;

  useEffect(() => {
    if (isUploading) {
      setIsDecrypting(false);
      setError("");
      return;
    }

    if (localPreviewUrl) {
      setMediaUrl(localPreviewUrl);
      return;
    }

    let cancelled = false;
    setIsDecrypting(true);
    setError("");
    deriveConversationKeyCandidates(conversationId)
      .then((keys) => decryptUploadedAttachment(attachment.encryptedResourceRef, keys, attachment.mimeType))
      .then((decrypted) => {
        if (!cancelled) setMediaUrl(decrypted.url);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load attachment.");
      })
      .finally(() => {
        if (!cancelled) setIsDecrypting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.encryptedResourceRef, attachment.mimeType, conversationId, isUploading, localPreviewUrl]);

  useEffect(() => {
    return () => {
      if (mediaUrl && mediaUrl !== localPreviewUrl && mediaUrl.startsWith("blob:")) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [mediaUrl, localPreviewUrl]);

  if (attachment.kind === "image") {
    if (isUploading) {
      return <MediaLoadingShell kind="image" label="Sending photo…" />;
    }
    if (isDecrypting || !mediaUrl) {
      return <MediaLoadingShell kind="image" label="Loading photo…" />;
    }
    return (
      <button type="button" className="attachment-image tap-spring" onClick={() => onOpen(mediaUrl, "image")}>
        <img src={mediaUrl} alt="Shared image" loading="lazy" decoding="async" />
      </button>
    );
  }

  if (attachment.kind === "video") {
    if (isUploading) {
      return <MediaLoadingShell kind="video" label="Sending video…" />;
    }
    if (isDecrypting || !mediaUrl) {
      return <MediaLoadingShell kind="video" label="Loading video…" />;
    }
    return (
      <div className="attachment-video-player">
        <video src={mediaUrl} controls playsInline preload="metadata" />
        <button
          type="button"
          className="attachment-video-expand tap-spring"
          onClick={() => onOpen(mediaUrl, "video")}
          aria-label="Open video fullscreen"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    );
  }

  if (attachment.kind === "voice") {
    if (isUploading) {
      return (
        <div className="attachment-pending">
          <Loader2 size={16} className="spin" />
          <span>Sending voice note…</span>
        </div>
      );
    }
    if (isDecrypting || !mediaUrl) {
      return (
        <div className="attachment-pending">
          <Loader2 size={16} className="spin" />
          <span>Loading voice note…</span>
        </div>
      );
    }
    return <VoiceNotePlayer src={mediaUrl} durationMs={attachment.durationMs} tone={tone} />;
  }

  return (
    <div className="attachment-file">
      <Paperclip size={15} />
      <span>{isUploading ? "Sending file…" : "Encrypted file"}</span>
      {error ? <small className="attachment-error">{error}</small> : null}
    </div>
  );
}

async function decryptUploadedAttachment(resourceUrl: string, conversationKeys: string[], fallbackMimeType: string) {
  const response = await fetch(resourceUrl);
  if (!response.ok) throw new Error("Attachment fetch failed.");

  const bytes = new Uint8Array(await response.arrayBuffer());
  const separatorIndex = bytes.findIndex((byte) => byte === 10);
  if (separatorIndex < 1) throw new Error("Invalid encrypted attachment.");

  const metadata = JSON.parse(new TextDecoder().decode(bytes.slice(0, separatorIndex))) as {
    iv: string;
    mimeType?: string;
  };
  const ciphertext = bytes.slice(separatorIndex + 1);
  const encryptedBytes = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength);
  let plaintext: ArrayBuffer | null = null;
  for (const conversationKey of conversationKeys) {
    try {
      const key = await importAesKey(conversationKey);
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(metadata.iv).buffer as ArrayBuffer },
        key,
        encryptedBytes
      );
      break;
    } catch {
      // Try the next key candidate.
    }
  }
  if (!plaintext) throw new Error("Attachment decrypt failed.");
  const blob = new Blob([plaintext], { type: metadata.mimeType || fallbackMimeType || "application/octet-stream" });

  return {
    url: URL.createObjectURL(blob),
    name: "ciphera-attachment"
  };
}

function fromBase64(base64: string) {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
