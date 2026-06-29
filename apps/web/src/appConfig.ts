import type { Message } from "@ciphera/types";

export type SocketStatus = "connecting" | "connected" | "reconnecting";
export type PushAccess = "checking" | "ready";

export const deviceId = "browser-primary-device";
export const emptyMessages: Message[] = [];

export function resolveSocketUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL?.trim();
  if (configured) {
    if (configured.startsWith("/")) return `${window.location.origin}${configured.replace(/\/$/, "")}`;
    return configured.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) return window.location.origin;
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl?.startsWith("/")) return window.location.origin;
  return (apiUrl ?? "http://localhost:3000/api").replace(/\/api\/?$/, "");
}

export function getNotificationConversationFromLocation() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("conversation");
}

export function getInitialAuthMode(): "login" | "signup" {
  if (getInviteTokenFromLocation()) return "signup";
  return window.location.pathname === "/register" ? "signup" : "login";
}

export function getInviteTokenFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/invite\/([^/]+)$/);
  const queryToken = new URLSearchParams(window.location.search).get("invite");
  const raw = pathMatch?.[1] ?? queryToken ?? "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
