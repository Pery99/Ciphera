import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { Message } from "@ciphera/types";
import { sendMessageSchema, type SendMessageInput } from "@ciphera/validation";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, conversationId: string): Promise<Message[]> {
    await this.ensureParticipant(userId, conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: { attachments: true },
      orderBy: { createdAt: "asc" },
      take: 100
    });
    return messages.map(mapMessage);
  }

  async create(senderId: string, input: SendMessageInput): Promise<Message> {
    const payload = sendMessageSchema.parse(input);
    await this.ensureParticipant(senderId, payload.conversationId);

    if (payload.replyToId) {
      const parent = await this.prisma.message.findFirst({
        where: { id: payload.replyToId, conversationId: payload.conversationId }
      });
      if (!parent) throw new BadRequestException("Reply target not found in this conversation.");
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: payload.conversationId,
        senderId,
        replyToId: payload.replyToId,
        encryptedPayload: payload.encryptedPayload,
        attachments: {
          create: payload.attachments.map((attachment) => ({
            kind: attachment.kind,
            encryptedResourceRef: attachment.encryptedResourceRef,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            durationMs: attachment.durationMs
          }))
        }
      },
      include: { attachments: true }
    });

    await this.prisma.conversation.update({
      where: { id: payload.conversationId },
      data: { updatedAt: new Date() }
    });

    return mapMessage(message);
  }

  async markDelivered(userId: string, conversationId: string, messageId: string) {
    await this.ensureParticipant(userId, conversationId);
    const existing = await this.findConversationMessage(conversationId, messageId);
    this.ensureRecipientCanUpdateStatus(userId, existing.senderId);

    const message = await this.prisma.message.update({
      where: { id: existing.id },
      data: { status: "delivered", deliveredAt: new Date() },
      include: { attachments: true }
    });
    return mapMessage(message);
  }

  async markRead(userId: string, conversationId: string, messageId: string) {
    await this.ensureParticipant(userId, conversationId);
    const existing = await this.findConversationMessage(conversationId, messageId);
    this.ensureRecipientCanUpdateStatus(userId, existing.senderId);

    const message = await this.prisma.message.update({
      where: { id: existing.id },
      data: { status: "read", readAt: new Date() },
      include: { attachments: true }
    });
    return mapMessage(message);
  }

  private async ensureParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });
    if (!participant) throw new ForbiddenException("You are not a participant in this conversation.");
  }

  private async findConversationMessage(conversationId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true, senderId: true }
    });
    if (!message) throw new BadRequestException("Message not found in this conversation.");
    return message;
  }

  private ensureRecipientCanUpdateStatus(userId: string, senderId: string) {
    if (userId === senderId) {
      throw new ForbiddenException("Senders cannot update delivery status for their own messages.");
    }
  }
}

type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  replyToId: string | null;
  encryptedPayload: unknown;
  attachments: Array<{
    id: string;
    kind: string;
    encryptedResourceRef: string;
    mimeType: string;
    sizeBytes: number;
    durationMs: number | null;
    width: number | null;
    height: number | null;
  }>;
  status: string;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
};

export function mapMessage(message: MessageRecord): Message {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    replyToId: message.replyToId,
    encryptedPayload: message.encryptedPayload as Message["encryptedPayload"],
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind as Message["attachments"][number]["kind"],
      encryptedResourceRef: attachment.encryptedResourceRef,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      durationMs: attachment.durationMs,
      width: attachment.width,
      height: attachment.height
    })),
    status: message.status as Message["status"],
    createdAt: message.createdAt.toISOString(),
    deliveredAt: message.deliveredAt?.toISOString() ?? null,
    readAt: message.readAt?.toISOString() ?? null
  };
}
