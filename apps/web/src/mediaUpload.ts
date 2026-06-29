import type { Message } from "@ciphera/types";
import { importAesKey, toBase64 } from "@ciphera/crypto";
import { api } from "./api.ts";
import type { PendingAttachment } from "./components/PendingAttachmentStrip.tsx";

async function encryptFileForUpload(file: File, conversationKey: string) {
  const key = await importAesKey(conversationKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  const metadata = JSON.stringify({
    algorithm: "AES-GCM-256",
    iv: toBase64(iv),
    originalName: file.name,
    mimeType: file.type || "application/octet-stream"
  });
  return new Blob([metadata, "\n", ciphertext], { type: "application/octet-stream" });
}

export async function uploadAttachment(
  attachment: PendingAttachment,
  conversationKey: string
): Promise<Message["attachments"][number]> {
  const signature = await api.uploadSignature();
  const encryptedFile = await encryptFileForUpload(attachment.file, conversationKey);
  const formData = new FormData();
  formData.append("file", encryptedFile, `${attachment.id}.ciphera`);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("public_id", signature.publicId);

  const response = await fetch(signature.uploadUrl, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Encrypted media upload failed.");
  }

  const uploaded = (await response.json()) as { public_id: string; secure_url?: string; bytes?: number };

  return {
    id: attachment.id,
    kind: attachment.kind,
    encryptedResourceRef: uploaded.secure_url ?? `cloudinary://${uploaded.public_id}`,
    mimeType: attachment.mimeType,
    sizeBytes: uploaded.bytes ?? attachment.sizeBytes,
    durationMs: attachment.durationMs ?? null,
    width: null,
    height: null
  };
}
