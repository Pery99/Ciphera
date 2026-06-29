import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PushModule } from "../push/push.module";
import { NotificationProcessor } from "./notification.processor";
import { QueueService } from "./queue.service";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get("REDIS_URL") ?? "redis://localhost:6379" },
        prefix: config.get("QUEUE_PREFIX") ?? "ciphera"
      })
    }),
    BullModule.registerQueue({ name: "notifications" }, { name: "media" }),
    PushModule
  ],
  providers: [QueueService, NotificationProcessor],
  exports: [QueueService]
})
export class QueuesModule {}
