import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { compare, hash } from "bcryptjs";
import type { AuthSession, UserProfile } from "@ciphera/types";
import type { LoginInput, SignUpInput } from "@ciphera/validation";
import { getAccessSecret, getRefreshSecret } from "../../config/security.config";
import { readRefreshTokenFromRequest } from "./auth-cookies";
import { InvitesService } from "../invites/invites.service";
import { PrismaService } from "../prisma/prisma.service";
import { toProfile } from "../users/user.mapper";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly invites: InvitesService
  ) {}

  async signUp(input: SignUpInput, request: Request): Promise<AuthSession> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] }
    });
    if (existing) throw new ConflictException("Email or username is already in use.");

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        name: input.name,
        passwordHash: await hash(input.password, 12),
        publicIdentityKey: input.publicIdentityKey,
        devices: {
          create: { label: "Primary device", publicKey: input.publicIdentityKey }
        }
      }
    });

    const redirectConversationId = input.inviteToken
      ? (await this.invites.accept(input.inviteToken, user.id)).conversationId
      : undefined;

    return this.issueSession(toProfile(user), request, redirectConversationId);
  }

  async login(input: LoginInput, request: Request): Promise<AuthSession> {
    const identifier = input.username.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: identifier.toLowerCase() }
        ]
      }
    });
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return this.issueSession(toProfile(user), request);
  }

  async refresh(request: Request): Promise<AuthSession> {
    const refreshToken = readRefreshTokenFromRequest(request.cookies ?? {});
    if (!refreshToken) {
      throw new UnauthorizedException("Session expired.");
    }

    return this.refreshWithToken(refreshToken, request);
  }

  async logout(request: Request) {
    const refreshToken = readRefreshTokenFromRequest(request.cookies ?? {});
    if (!refreshToken) return;

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type?: string; sid?: string }>(refreshToken, {
        secret: getRefreshSecret(this.config)
      });

      if (payload.type === "refresh" && payload.sid) {
        await this.prisma.session.updateMany({
          where: { id: payload.sid, userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
    } catch {
      // Ignore invalid cookies during logout.
    }
  }

  async issueSession(user: UserProfile, request: Request, redirectConversationId?: string): Promise<AuthSession> {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshHash: "pending",
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    const tokens = await this.rotateSession(user, session.id, request);
    return { ...tokens, redirectConversationId };
  }

  private async refreshWithToken(refreshToken: string, request: Request): Promise<AuthSession> {
    let payload: { sub: string; type?: string; sid?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: getRefreshSecret(this.config)
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    if (payload.type !== "refresh" || !payload.sid) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired.");
    }

    if (session.userId !== payload.sub) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    if (!(await compare(refreshToken, session.refreshHash))) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return {
      accessToken: await this.issueAccessToken(toProfile(session.user)),
      refreshToken,
      user: toProfile(session.user)
    };
  }

  private async rotateSession(
    user: UserProfile,
    sessionId: string,
    request: Request,
    previousRefreshHash?: string
  ): Promise<AuthSession> {
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: "refresh", sid: sessionId },
      { secret: getRefreshSecret(this.config), expiresIn: "30d" }
    );

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshHash: await hash(refreshToken, 12),
        previousRefreshHash,
        previousRotatedAt: previousRefreshHash ? new Date() : null,
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return { accessToken, refreshToken, user };
  }

  private issueAccessToken(user: UserProfile) {
    return this.jwt.signAsync(
      { sub: user.id, username: user.username },
      { secret: getAccessSecret(this.config), expiresIn: "15m" }
    );
  }
}
