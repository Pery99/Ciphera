import type { AuthSession } from "@ciphera/types";
import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { getRefreshCookieOptions, REFRESH_COOKIE_NAME } from "../../config/security.config";

export function readRefreshTokenFromRequest(cookies: Record<string, string | undefined>) {
  const token = cookies[REFRESH_COOKIE_NAME];
  return typeof token === "string" && token.length >= 20 ? token : undefined;
}

export function attachRefreshCookie(response: Response, config: ConfigService, refreshToken: string) {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(config));
}

export function clearRefreshCookie(response: Response, config: ConfigService) {
  response.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(config));
}

/** Strips the refresh token so browser JavaScript only receives the short-lived access token. */
export function toClientAuthSession(session: AuthSession) {
  const { refreshToken: _refreshToken, ...clientSession } = session;
  return clientSession;
}
