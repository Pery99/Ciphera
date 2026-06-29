import { api } from "./api.ts";
import { ApiError } from "./apiErrors.ts";

export type PushPermissionState = NotificationPermission | "unsupported";
export type PushSetupResult = { ok: true } | { ok: false; reason: string };

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

export function isBraveBrowser() {
  return "brave" in navigator;
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isInstalledPwa() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export type PushSupportState =
  | { status: "ready" }
  | { status: "ios-install"; message: string }
  | { status: "unsupported"; message: string };

export function getPushSupportState(): PushSupportState {
  if (isIosDevice()) {
    if (!isInstalledPwa()) {
      return {
        status: "ios-install",
        message:
          "On iPhone, open Ciphera in Safari, tap Share, then Add to Home Screen. Open Ciphera from your home screen to enable notifications. Chrome on iPhone cannot receive push alerts."
      };
    }
  }

  if (!isPushSupported()) {
    return {
      status: "unsupported",
      message: "This browser does not support push notifications. Try Chrome on desktop or Android, or install Ciphera to your iPhone home screen with Safari."
    };
  }

  return { status: "ready" };
}

function formatPushError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Refresh and sign in again.";
    if (error.status >= 500) return "Ciphera could not reach the server. Make sure the API is running.";
    return error.message;
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Notification permission was blocked.";
    if (error.name === "AbortError") {
      if (isBraveBrowser()) {
        return "Brave interrupted push setup. Open brave://settings/privacy and enable Google services for push messaging, or skip for now.";
      }
      return "Notification setup was interrupted. Try again or skip for now.";
    }
    return error.message || "This browser blocked push notifications.";
  }
  if (error instanceof Error) return error.message;
  return "Could not enable notifications. Try again or skip for now.";
}

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function isPushSupported() {
  return getPushPermissionState() !== "unsupported" && "PushManager" in window;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

async function waitForActiveWorker(registration: ServiceWorkerRegistration, timeoutMs = 15000) {
  if (registration.active) return registration;

  const worker = registration.installing ?? registration.waiting;
  if (worker) {
    const installingWorker = worker;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("Notification setup timed out. You can skip and try again later."));
      }, timeoutMs);

      function handleStateChange() {
        if (installingWorker.state === "activated") {
          window.clearTimeout(timer);
          installingWorker.removeEventListener("statechange", handleStateChange);
          resolve();
        }
      }

      installingWorker.addEventListener("statechange", handleStateChange);
      if (installingWorker.state === "activated") handleStateChange();
    });
    return registration;
  }

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Notification setup timed out. You can skip and try again later."));
      }, timeoutMs);
    })
  ]);

  return registration;
}

async function waitForServiceWorker(timeoutMs = 15000) {
  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!registration) {
    throw new Error("Could not register the Ciphera service worker.");
  }

  return waitForActiveWorker(registration, timeoutMs);
}

async function createBrowserSubscription(registration: ServiceWorkerRegistration, publicKey: string) {
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  } catch (firstError) {
    const stale = await registration.pushManager.getSubscription();
    if (stale) await stale.unsubscribe().catch(() => {});
    try {
      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    } catch {
      throw firstError;
    }
  }
}

export async function ensurePushSubscription(): Promise<PushSetupResult> {
  try {
    const permission = getPushPermissionState();
    if (permission !== "granted") return { ok: false, reason: "Notifications are not allowed yet." };
    if (!("PushManager" in window)) {
      return { ok: false, reason: "This browser does not support push notifications." };
    }

    const registration = await waitForServiceWorker();
    const { publicKey } = await api.getPushPublicKey();
    if (!publicKey) {
      return { ok: false, reason: "Push is not configured on the server. Add VAPID keys and restart the API." };
    }

    let subscription = await createBrowserSubscription(registration, publicKey);
    let json = subscription.toJSON();

    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      await subscription.unsubscribe().catch(() => {});
      subscription = await createBrowserSubscription(registration, publicKey);
      json = subscription.toJSON();
    }

    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "Could not create a push subscription in this browser." };
    }

    await api.subscribePush({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      }
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: formatPushError(error) };
  }
}

export async function requestPushAccess(): Promise<PushSetupResult> {
  try {
    const current = getPushPermissionState();
    if (current === "unsupported") {
      return { ok: false, reason: "This browser does not support push notifications." };
    }
    if (current === "denied") {
      return { ok: false, reason: "Notifications are blocked in your browser settings." };
    }

    const permission = current === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Notification permission was not granted." };
    }

    return ensurePushSubscription();
  } catch (error) {
    return { ok: false, reason: formatPushError(error) };
  }
}

export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    await api.unsubscribePush().catch(() => {});
    return;
  }

  const endpoint = subscription.endpoint;
  await api.unsubscribePush(endpoint).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}