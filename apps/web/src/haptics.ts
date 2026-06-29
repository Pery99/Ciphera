export function tapHaptic(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers block vibration outside user gestures.
  }
}

export function successHaptic() {
  tapHaptic([8, 24, 12]);
}

export function errorHaptic() {
  tapHaptic([12, 40, 12, 40]);
}