import { Body, Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { loginSchema, signUpSchema } from "@ciphera/validation";
import { attachRefreshCookie, clearRefreshCookie, toClientAuthSession } from "./auth-cookies";
import { AuthService } from "./auth.service";

@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("signup")
  async signUp(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.signUp(signUpSchema.parse(body), request);
    attachRefreshCookie(response, this.config, requireRefreshToken(session));
    return toClientAuthSession(session);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(loginSchema.parse(body), request);
    attachRefreshCookie(response, this.config, requireRefreshToken(session));
    return toClientAuthSession(session);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.auth.refresh(request);
    attachRefreshCookie(response, this.config, requireRefreshToken(session));
    return toClientAuthSession(session);
  }

  @HttpCode(204)
  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request);
    clearRefreshCookie(response, this.config);
  }
}

function requireRefreshToken(session: { refreshToken?: string }) {
  if (!session.refreshToken) {
    throw new Error("Auth session is missing a refresh token.");
  }
  return session.refreshToken;
}
