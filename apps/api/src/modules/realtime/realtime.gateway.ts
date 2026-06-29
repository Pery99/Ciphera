import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@ciphera/contracts";
import type { Message } from "@ciphera/types";
import { getAccessSecret, normalizeWebOrigin } from "../../config/security.config";
import { MessagesService } from "../messages/messages.service";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queues/queue.service";

type AuthedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: { id: string; username: string } };
};

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => callback(null, isAllowedSocketOrigin(origin) ? origin ?? true : false),
    credentials: true
  }
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messages: MessagesService,
    private readonly prisma: PrismaService,
    private readonly queues: QueueService
  ) {}

  async handleConnection(socket: AuthedSocket) {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; username: string }>(token, {
        secret: getAccessSecret(this.config)
      });
      socket.data.user = { id: payload.sub, username: payload.username };
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(_socket: AuthedSocket) {}

  @SubscribeMessage("conversation:join")
  async join(@ConnectedSocket() socket: AuthedSocket, @MessageBody() conversationId: string) {
    const user = this.requireUser(socket);
    await this.ensureParticipant(user.id, conversationId);
    socket.join(conversationId);
  }

  @SubscribeMessage("message:send")
  async send(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: Parameters<ClientToServerEvents["message:send"]>[0]
  ) {
    const user = this.requireUser(socket);
    const message = await this.messages.create(user.id, {
      conversationId: body.conversationId,
      replyToId: body.replyToId,
      encryptedPayload: body.encryptedPayload,
      attachments: (body.attachments ?? []).map((attachment) => ({
        kind: attachment.kind,
        encryptedResourceRef: attachment.encryptedResourceRef,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        durationMs: attachment.durationMs ?? undefined
      }))
    });
    this.logger.log(`Stored encrypted message ${message.id} for conversation ${message.conversationId}`);
    this.server.to(message.conversationId).emit("message:new", message);
    await this.queueMessageNotifications(message);
  }

  @SubscribeMessage("message:delivered")
  async delivered(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: { messageId: string; conversationId: string }) {
    const user = this.requireUser(socket);
    const message = await this.messages.markDelivered(user.id, body.conversationId, body.messageId);
    this.server.to(message.conversationId).emit("message:status", {
      id: message.id,
      conversationId: message.conversationId,
      status: message.status,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt
    });
  }

  @SubscribeMessage("message:read")
  async read(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: { messageId: string; conversationId: string }) {
    const user = this.requireUser(socket);
    const message = await this.messages.markRead(user.id, body.conversationId, body.messageId);
    this.server.to(message.conversationId).emit("message:status", {
      id: message.id,
      conversationId: message.conversationId,
      status: message.status,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt
    });
  }

  @SubscribeMessage("typing:start")
  async typingStart(@ConnectedSocket() socket: AuthedSocket, @MessageBody() conversationId: string) {
    const user = this.requireUser(socket);
    await this.ensureParticipant(user.id, conversationId);
    socket.to(conversationId).emit("typing:update", { conversationId, userId: user.id, isTyping: true });
  }

  @SubscribeMessage("typing:stop")
  async typingStop(@ConnectedSocket() socket: AuthedSocket, @MessageBody() conversationId: string) {
    const user = this.requireUser(socket);
    await this.ensureParticipant(user.id, conversationId);
    socket.to(conversationId).emit("typing:update", { conversationId, userId: user.id, isTyping: false });
  }

  private async queueMessageNotifications(message: Message) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: message.conversationId,
        userId: { not: message.senderId }
      },
      select: { userId: true }
    });

    await Promise.all(
      participants.map(async (participant) => {
        await this.queues.queueMessageNotify({
          recipientUserId: participant.userId,
          conversationId: message.conversationId,
          messageId: message.id
        });
      })
    );
  }

  private requireUser(socket: AuthedSocket) {
    if (!socket.data.user) {
      socket.disconnect(true);
      throw new Error("Unauthenticated socket.");
    }
    return socket.data.user;
  }

  private async ensureParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!participant) {
      throw new Error("Socket user is not a participant in this conversation.");
    }
  }
}

function isAllowedSocketOrigin(origin?: string) {
  if (!origin) return true;
  const configured = normalizeWebOrigin(process.env.CORS_ORIGIN ?? "http://localhost:5173");
  if (normalizeWebOrigin(origin) === configured) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}
