export type Id = string;
export type UserProfile = {
    id: Id;
    name: string;
    username: string;
    avatarUrl?: string | null;
    bio?: string | null;
    publicIdentityKey: string;
};
export type MessageStatus = "queued" | "sent" | "delivered" | "read";
export type AttachmentKind = "image" | "video" | "document" | "voice";
export type EncryptedEnvelope = {
    algorithm: "AES-GCM-256";
    ciphertext: string;
    iv: string;
    senderDeviceId: Id;
    keyVersion: number;
    aad?: string;
};
export type MediaAttachment = {
    id: Id;
    kind: AttachmentKind;
    encryptedResourceRef: string;
    mimeType: string;
    sizeBytes: number;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
};
export type Message = {
    id: Id;
    conversationId: Id;
    senderId: Id;
    replyToId?: Id | null;
    encryptedPayload: EncryptedEnvelope;
    attachments: MediaAttachment[];
    status: MessageStatus;
    createdAt: string;
    deliveredAt?: string | null;
    readAt?: string | null;
};
export type Conversation = {
    id: Id;
    participantIds: Id[];
    peer: UserProfile;
    lastMessage?: Message | null;
    unreadCount: number;
    createdAt: string;
    updatedAt: string;
};
export type AuthSession = {
    accessToken: string;
    /** Server-side only. The API strips this before returning auth JSON to the browser. */
    refreshToken?: string;
    user: UserProfile;
    redirectConversationId?: string;
};
export type InvitePreview = {
    token: string;
    inviter: Pick<UserProfile, "id" | "name" | "username" | "avatarUrl">;
    expiresAt: string;
};
