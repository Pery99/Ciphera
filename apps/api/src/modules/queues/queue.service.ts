import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

@Injectable()
export class QueueService {
  constructor(@InjectQueue("notifications") private readonly notifications: Queue) {}

  queueInviteCreated(payload: { inviteId: string; inviterId: string; inviteUrl: string }) {
    return this.notifications.add("invite.created", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500
    });
  }

  queueMessageNotify(payload: { recipientUserId: string; conversationId: string; messageId: string }) {
    return this.notifications.add("message.notify", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1500 },
      removeOnComplete: 200,
      removeOnFail: 500
    });
  }
}
