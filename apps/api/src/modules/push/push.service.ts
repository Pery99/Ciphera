import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import type { PushSubscribeInput } from "@ciphera/validation";
import { PrismaService } from "../prisma/prisma.service";

type MessageNotifyPayload = {
  conversationId: string;
  messageId: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY");
    const subject = this.config.get<string>("VAPID_SUBJECT") ?? "mailto:support@ciphera.app";

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    } else {
      this.logger.warn("VAPID keys are missing. Push notifications are disabled.");
    }
  }

  getPublicKey() {
    return this.config.get<string>("VAPID_PUBLIC_KEY") ?? "";
  }

  async subscribe(userId: string, input: PushSubscribeInput, userAgent?: string) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent
      }
    });
  }

  async unsubscribe(userId: string, endpoint?: string) {
    if (endpoint) {
      await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
      return;
    }
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  async notifyMessageRecipient(recipientUserId: string, payload: MessageNotifyPayload) {
    if (!this.configured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: recipientUserId }
    });

    if (subscriptions.length === 0) return;

    const body = JSON.stringify({
      title: "Ciphera",
      body: "You have a new message",
      data: {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        type: "message"
      }
    });

    await Promise.all(
      subscriptions.map(async (subscription: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            body
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: subscription.id } });
          } else {
            this.logger.warn(`Push delivery failed for subscription ${subscription.id}.`);
          }
        }
      })
    );
  }
}
