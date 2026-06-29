import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PushService } from "../push/push.service";

@Processor("notifications")
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly push: PushService) {
    super();
  }

  async process(job: Job) {
    if (job.name === "invite.created") {
      this.logger.log(`Queued invite notification for invite ${job.data.inviteId}`);
      return;
    }

    if (job.name === "message.notify") {
      await this.push.notifyMessageRecipient(job.data.recipientUserId, {
        conversationId: job.data.conversationId,
        messageId: job.data.messageId
      });
    }
  }
}
