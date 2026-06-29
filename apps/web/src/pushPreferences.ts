const SKIP_KEY = "ciphera.push.skipped";
const ENABLED_KEY = "ciphera.push.enabled";

export function isPushSkipped() {
  return localStorage.getItem(SKIP_KEY) === "1";
}

export function markPushSkipped() {
  localStorage.setItem(SKIP_KEY, "1");
}

export function isPushMarkedEnabled() {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function markPushEnabled() {
  localStorage.setItem(ENABLED_KEY, "1");
  localStorage.removeItem(SKIP_KEY);
}

export function clearPushEnabled() {
  localStorage.removeItem(ENABLED_KEY);
}