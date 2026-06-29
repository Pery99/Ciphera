import { ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queues/queue.service";
import { toProfile } from "../users/user.mapper";

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queues: QueueService
  ) {}

  async create(inviterId: string) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await this.prisma.invite.create({
      data: {
        tokenHash: hashInviteToken(token),
        inviterId,
        expiresAt
      }
    });
    const inviteUrl = `${this.config.get("APP_WEB_URL") ?? "http://localhost:5173"}/invite/${token}`;

    await this.queues.queueInviteCreated({ inviteId: invite.id, inviterId, inviteUrl });

    return { inviteUrl, token, expiresAt: expiresAt.toISOString() };
  }

  async preview(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(token) } });
    if (!invite) throw new NotFoundException("Invite not found.");
    if (invite.acceptedAt || invite.expiresAt < new Date()) throw new GoneException("Invite is no longer active.");

    const inviter = await this.prisma.user.findUnique({ where: { id: invite.inviterId } });
    if (!inviter) throw new NotFoundException("Inviter not found.");

    return {
      token,
      inviter: toProfile(inviter),
      expiresAt: invite.expiresAt.toISOString()
    };
  }

  async accept(token: string, acceptedById: string) {
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(token) } });
    if (!invite) throw new NotFoundException("Invite not found.");
    if (invite.expiresAt < new Date()) throw new GoneException("Invite is no longer active.");
    if (invite.inviterId === acceptedById) throw new ConflictException("You cannot accept your own invite.");

    if (invite.acceptedAt) {
      if (invite.acceptedById === acceptedById && invite.conversationId) {
        return { conversationId: invite.conversationId };
      }
      throw new GoneException("Invite is no longer active.");
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: "direct",
        AND: [
          { participants: { some: { userId: invite.inviterId } } },
          { participants: { some: { userId: acceptedById } } }
        ]
      }
    });

    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId: invite.inviterId }, { userId: acceptedById }]
          }
        }
      }));

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: {
        acceptedById,
        conversationId: conversation.id,
        acceptedAt: new Date()
      }
    });

    return { conversationId: conversation.id };
  }
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
