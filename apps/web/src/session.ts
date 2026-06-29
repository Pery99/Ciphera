const LEGACY_STORAGE_KEY = "ciphera.session";
const LEGACY_REFRESH_TOKEN_KEY = "ciphera.refreshToken";

/** Removes tokens saved by older builds. Refresh tokens now live only in httpOnly cookies. */
export function clearLegacySessionStorage() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage errors.
  }
}
