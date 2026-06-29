import type { AuthSession, Conversation, InvitePreview, Message, UserProfile } from "@ciphera/types";

export type ApiRoutes = {
  "POST /auth/signup": { body: unknown; response: AuthSession };
  "POST /auth/login": { body: unknown; response: AuthSession };
  "POST /auth/refresh": { body: Record<string, never>; response: AuthSession };
  "POST /auth/logout": { body: Record<string, never>; response: void };
  "GET /users/me": { response: UserProfile };
  "GET /users/search": { query: { username: string }; response: UserProfile[] };
  "POST /conversations": { body: { peerUsername: string }; response: Conversation };
  "GET /conversations": { response: Conversation[] };
  "GET /conversations/:id/messages": { response: Message[] };
  "POST /invites": { response: { inviteUrl: string; token: string; expiresAt: string } };
  "GET /invites/:token": { response: InvitePreview };
  "POST /invites/:token/accept": { response: { conversationId: string } };
  "POST /media/upload-signature": {
    response: { uploadUrl: string; cloudName: string; apiKey: string; publicId: string; timestamp: number; signature: string };
  };
};

export type ClientToServerEvents = {
  "conversation:join": (conversationId: string) => void;
  "message:send": (payload: {
    conversationId: string;
    replyToId?: string;
    encryptedPayload: Message["encryptedPayload"];
    attachments?: Message["attachments"];
  }) => void;
  "message:delivered": (payload: { messageId: string; conversationId: string }) => void;
  "message:read": (payload: { messageId: string; conversationId: string }) => void;
  "typing:start": (conversationId: string) => void;
  "typing:stop": (conversationId: string) => void;
};

export type ServerToClientEvents = {
  "message:new": (message: Message) => void;
  "message:status": (payload: Pick<Message, "id" | "conversationId" | "status" | "deliveredAt" | "readAt">) => void;
  "typing:update": (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
};
