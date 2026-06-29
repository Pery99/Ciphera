import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { CookieOptions } from "express";

const logger = new Logger("SecurityConfig");

const WEAK_SECRETS = new Set([
  "dev-access-secret",
  "dev-refresh-secret",
  "replace-with-a-long-access-secret",
  "replace-with-a-long-refresh-secret",
  "change-me",
  "secret"
]);

export const REFRESH_COOKIE_NAME = "ciphera_refresh";

export function isProduction(config: ConfigService) {
  return config.get<string>("NODE_ENV") === "production";
}

export function normalizeWebOrigin(value?: string) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

export function isAllowedCorsOrigin(config: ConfigService, origin?: string) {
  if (!origin) {
    return true;
  }

  const configured = normalizeWebOrigin(config.get<string>("CORS_ORIGIN") ?? "http://localhost:5173");
  if (normalizeWebOrigin(origin) === configured) {
    return true;
  }

  if (!isProduction(config) && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)) {
    return true;
  }

  return false;
}

export function validateSecurityEnvironment(config: ConfigService) {
  const accessSecret = config.get<string>("JWT_ACCESS_SECRET");
  const refreshSecret = config.get<string>("JWT_REFRESH_SECRET");

  if (isProduction(config)) {
    assertSecret("JWT_ACCESS_SECRET", accessSecret);
    assertSecret("JWT_REFRESH_SECRET", refreshSecret);

    if (accessSecret === refreshSecret) {
      throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.");
    }

    return;
  }

  if (!accessSecret || !refreshSecret) {
    logger.warn("Using development JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET before production.");
  }
}

export function getAccessSecret(config: ConfigService) {
  return config.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret";
}

export function getRefreshSecret(config: ConfigService) {
  return config.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret";
}

export function getRefreshCookieOptions(config: ConfigService): CookieOptions {
  const production = isProduction(config);
  const configuredSameSite = config.get<string>("COOKIE_SAME_SITE");
  const configuredSecure = config.get<string>("COOKIE_SECURE");
  const requestedSameSite = normalizeSameSite(configuredSameSite);
  const sameSite = production ? requestedSameSite ?? "none" : requestedSameSite === "strict" ? "strict" : "lax";
  const secure = production
    ? configuredSecure === "true" || (configuredSecure !== "false" && sameSite === "none")
    : false;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/api",
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
}

function assertSecret(name: string, value?: string) {
  if (!value || value.trim().length < 32) {
    throw new Error(`${name} must be set to at least 32 characters in production.`);
  }

  if (WEAK_SECRETS.has(value.trim())) {
    throw new Error(`${name} is using a placeholder value. Generate a strong random secret for production.`);
  }
}

function normalizeSameSite(value?: string): CookieOptions["sameSite"] | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "lax" || normalized === "strict" || normalized === "none") {
    return normalized;
  }
  return undefined;
}
