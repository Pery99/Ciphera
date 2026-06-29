import type { EncryptedEnvelope, MediaAttachment, Message } from "@ciphera/types";

const DB_NAME = "ciphera-outbound";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const BLOBS_STORE = "blobs";

export type StoredPendingAttachment = {
  id: string;
  kind: MediaAttachment["kind"];
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
};

export type OutboundQueueEntry = {
  clientMessageId: string;
  conversationId: string;
  replyToId?: string | null;
  encryptedPayload: EncryptedEnvelope;
  createdAt: string;
  pendingAttachments: StoredPendingAttachment[];
  dispatchState: "pending" | "dispatched";
};

function blobKey(clientMessageId: string, attachmentId: string) {
  return `${clientMessageId}:${attachmentId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE, { keyPath: "clientMessageId" });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open outbound queue."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Outbound queue request failed."));
  });
}

export function isNetworkAvailable() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export async function listOutboundMessages() {
  const db = await openDatabase();
  const entries = await requestToPromise(db.transaction(MESSAGES_STORE, "readonly").objectStore(MESSAGES_STORE).getAll());
  db.close();
  return (entries as OutboundQueueEntry[]).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function enqueueOutboundMessage(entry: OutboundQueueEntry, attachmentFiles: Map<string, Blob>) {
  const db = await openDatabase();
  const tx = db.transaction([MESSAGES_STORE, BLOBS_STORE], "readwrite");
  tx.objectStore(MESSAGES_STORE).put(entry);
  for (const [attachmentId, blob] of attachmentFiles) {
    tx.objectStore(BLOBS_STORE).put(blob, blobKey(entry.clientMessageId, attachmentId));
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save outbound message."));
    tx.onabort = () => reject(tx.error ?? new Error("Could not save outbound message."));
  });
  db.close();
}

export async function getOutboundAttachmentBlob(clientMessageId: string, attachmentId: string) {
  const db = await openDatabase();
  const blob = await requestToPromise(
    db.transaction(BLOBS_STORE, "readonly").objectStore(BLOBS_STORE).get(blobKey(clientMessageId, attachmentId))
  );
  db.close();
  return (blob as Blob | undefined) ?? null;
}

export async function markOutboundMessageDispatched(clientMessageId: string) {
  const entries = await listOutboundMessages();
  const entry = entries.find((item) => item.clientMessageId === clientMessageId);
  if (!entry || entry.dispatchState === "dispatched") return;

  const db = await openDatabase();
  const tx = db.transaction(MESSAGES_STORE, "readwrite");
  tx.objectStore(MESSAGES_STORE).put({ ...entry, dispatchState: "dispatched" });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not update outbound message."));
    tx.onabort = () => reject(tx.error ?? new Error("Could not update outbound message."));
  });
  db.close();
}

export async function removeOutboundMessage(clientMessageId: string) {
  const entries = await listOutboundMessages();
  const entry = entries.find((item) => item.clientMessageId === clientMessageId);
  if (!entry) return;

  const db = await openDatabase();
  const tx = db.transaction([MESSAGES_STORE, BLOBS_STORE], "readwrite");
  tx.objectStore(MESSAGES_STORE).delete(clientMessageId);
  for (const attachment of entry.pendingAttachments) {
    tx.objectStore(BLOBS_STORE).delete(blobKey(clientMessageId, attachment.id));
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not remove outbound message."));
    tx.onabort = () => reject(tx.error ?? new Error("Could not remove outbound message."));
  });
  db.close();
}

export async function clearOutboundQueue() {
  const db = await openDatabase();
  const tx = db.transaction([MESSAGES_STORE, BLOBS_STORE], "readwrite");
  tx.objectStore(MESSAGES_STORE).clear();
  tx.objectStore(BLOBS_STORE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clear outbound queue."));
    tx.onabort = () => reject(tx.error ?? new Error("Could not clear outbound queue."));
  });
  db.close();
}

export function outboundEntryToMessage(entry: OutboundQueueEntry, senderId: string): Message {
  return {
    id: entry.clientMessageId,
    conversationId: entry.conversationId,
    senderId,
    replyToId: entry.replyToId ?? null,
    encryptedPayload: entry.encryptedPayload,
    attachments: entry.pendingAttachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      encryptedResourceRef: `pending://${attachment.id}`,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      durationMs: attachment.durationMs ?? null,
      width: null,
      height: null
    })),
    status: "queued",
    createdAt: entry.createdAt
  };
}