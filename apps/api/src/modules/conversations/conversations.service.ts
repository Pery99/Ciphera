import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Conversation } from "@ciphera/types";
import { toProfile } from "../users/user.mapper";
import { mapMessage } from "../messages/messages.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<Conversation[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { attachments: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    return Promise.all(
      rows.map(async (conversation) => {
        const peer = conversation.participants.find((participant) => participant.userId !== userId)?.user;
        if (!peer) throw new NotFoundException("Conversation peer not found.");
        const self = conversation.participants.find((participant) => participant.userId === userId);
        const unreadCount = await this.countUnread(conversation.id, userId, self?.readCursorId ?? null);
        return {
          id: conversation.id,
          participantIds: conversation.participants.map((participant) => participant.userId),
          peer: toProfile(peer),
          lastMessage: conversation.messages[0] ? mapMessage(conversation.messages[0]) : null,
          unreadCount,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString()
        };
      })
    );
  }

  async markRead(userId: string, conversationId: string): Promise<{ unreadCount: number }> {
    await this.ensureParticipant(userId, conversationId);
    const latest = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" }
    });
    if (latest) {
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { readCursorId: latest.id }
      });
    }
    return { unreadCount: 0 };
  }

  private async countUnread(conversationId: string, userId: string, readCursorId: string | null) {
    const readCursor = readCursorId
      ? await this.prisma.message.findUnique({
          where: { id: readCursorId },
          select: { createdAt: true }
        })
      : null;

    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        ...(readCursor ? { createdAt: { gt: readCursor.createdAt } } : {})
      }
    });
  }

  private async ensureParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });
    if (!participant) throw new NotFoundException("Conversation not found.");
  }

  async createDirect(userId: string, peerUsername: string): Promise<Conversation> {
    const peer = await this.prisma.user.findUnique({ where: { username: peerUsername } });
    if (!peer) throw new NotFoundException("User not found.");
    if (peer.id === userId) throw new ConflictException("You cannot start a conversation with yourself.");

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: "direct",
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: peer.id } } }
        ]
      },
      include: { participants: { include: { user: true } }, messages: { include: { attachments: true }, take: 1 } }
    });

    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: {
          participants: {
            create: [{ userId }, { userId: peer.id }]
          }
        },
        include: { participants: { include: { user: true } }, messages: { include: { attachments: true }, take: 1 } }
      }));

    return {
      id: conversation.id,
      participantIds: conversation.participants.map((participant) => participant.userId),
      peer: toProfile(peer),
      lastMessage: null,
      unreadCount: 0,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    };
  }
}
