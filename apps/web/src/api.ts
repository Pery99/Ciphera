import type { AuthSession, Conversation, Message, UserProfile } from "@ciphera/types";
import { toApiError } from "./apiErrors.ts";
import { clearLegacySessionStorage } from "./session.ts";

function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (typeof window !== "undefined" && !import.meta.env.DEV) {
    if (!configured || configured.startsWith("/") || isCrossOrigin(configured)) {
      return `${window.location.origin}/api`;
    }
  }

  if (configured) {
    if (configured.startsWith("/")) {
      if (typeof window !== "undefined") return `${window.location.origin}${configured.replace(/\/$/, "")}`;
      return configured.replace(/\/$/, "");
    }
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && !import.meta.env.DEV) {
    return `${window.location.origin}/api`;
  }

  return "/api";
}

function isCrossOrigin(value: string) {
  try {
    return new URL(value).origin !== window.location.origin;
  } catch {
    return false;
  }
}

const AUTH_REFRESH_PATH = "/auth/refresh";
const AUTH_LOGOUT_PATH = "/auth/logout";

export class ApiClient {
  private refreshPromise: Promise<AuthSession> | null = null;

  constructor(
    private token?: string,
    private onAccessTokenRefreshed?: (accessToken: string) => void
  ) {}

  setToken(token?: string) {
    this.token = token;
  }

  setAccessTokenListener(listener?: (accessToken: string) => void) {
    this.onAccessTokenRefreshed = listener;
  }

  signUp(body: Record<string, unknown>) {
    return this.request<AuthSession>("/auth/signup", { method: "POST", body }).then((session) => this.captureAuthSession(session));
  }

  login(body: Record<string, unknown>) {
    return this.request<AuthSession>("/auth/login", { method: "POST", body }).then((session) => this.captureAuthSession(session));
  }

  refresh() {
    if (!this.refreshPromise) {
      this.refreshPromise = this.request<AuthSession>(AUTH_REFRESH_PATH, {
        method: "POST",
        body: {}
      })
        .then((session) => this.captureAuthSession(session))
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }

  logout() {
    return this.request<void>(AUTH_LOGOUT_PATH, {
      method: "POST",
      body: {}
    }).finally(() => {
      clearLegacySessionStorage();
    });
  }

  me() {
    return this.request<UserProfile>("/users/me");
  }

  search(username: string) {
    return this.request<UserProfile[]>(`/users/search?username=${encodeURIComponent(username)}`);
  }

  conversations() {
    return this.request<Conversation[]>("/conversations");
  }

  createConversation(peerUsername: string) {
    return this.request<Conversation>("/conversations", { method: "POST", body: { peerUsername } });
  }

  markConversationRead(conversationId: string) {
    return this.request<{ unreadCount: number }>(`/conversations/${conversationId}/read`, { method: "POST" });
  }

  getPushPublicKey() {
    return this.request<{ publicKey: string }>("/push/vapid-public-key");
  }

  subscribePush(body: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.request<{ id: string }>("/push/subscribe", { method: "POST", body });
  }

  unsubscribePush(endpoint?: string) {
    return this.request<{ ok: boolean }>("/push/unsubscribe", { method: "POST", body: endpoint ? { endpoint } : {} });
  }

  messages(conversationId: string) {
    return this.request<Message[]>(`/conversations/${conversationId}/messages`);
  }

  uploadSignature() {
    return this.request<{
      uploadUrl: string;
      cloudName: string;
      apiKey: string;
      publicId: string;
      timestamp: number;
      signature: string;
    }>("/media/upload-signature", { method: "POST" });
  }

  createInvite() {
    return this.request<{ inviteUrl: string; token: string; expiresAt: string }>("/invites", { method: "POST" });
  }

  previewInvite(token: string) {
    return this.request<{ token: string; inviter: Pick<UserProfile, "id" | "name" | "username" | "avatarUrl">; expiresAt: string }>(
      `/invites/${encodeURIComponent(token)}`
    );
  }

  acceptInvite(token: string) {
    return this.request<{ conversationId: string }>(`/invites/${encodeURIComponent(token)}/accept`, { method: "POST" });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
    allowRefreshRetry = true
  ): Promise<T> {
    const response = await fetch(`${resolveApiUrl()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include"
    });

    if (response.status === 401 && allowRefreshRetry && this.shouldAttemptRefresh(path)) {
      try {
        const session = await this.refresh();
        this.applyAccessToken(session.accessToken);
        return this.request<T>(path, options, false);
      } catch {
        clearLegacySessionStorage();
      }
    }

    if (!response.ok) {
      throw toApiError(response.status, await response.text());
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private shouldAttemptRefresh(path: string) {
    return path !== AUTH_REFRESH_PATH && path !== "/auth/login" && path !== "/auth/signup" && path !== AUTH_LOGOUT_PATH;
  }

  private captureAuthSession(session: AuthSession) {
    clearLegacySessionStorage();
    this.applyAccessToken(session.accessToken);
    return session;
  }

  private applyAccessToken(accessToken: string) {
    this.token = accessToken;
    this.onAccessTokenRefreshed?.(accessToken);
  }
}

export const api = new ApiClient();
