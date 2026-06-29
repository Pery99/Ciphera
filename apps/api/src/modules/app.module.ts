import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppThrottlerGuard } from "../config/app-throttler.guard";
import { AuthModule } from "./auth/auth.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { MediaModule } from "./media/media.module";
import { MessagesModule } from "./messages/messages.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueuesModule } from "./queues/queues.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { UsersModule } from "./users/users.module";
import { InvitesModule } from "./invites/invites.module";
import { PushModule } from "./push/push.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    InvitesModule,
    ConversationsModule,
    MessagesModule,
    RealtimeModule,
    MediaModule,
    PushModule,
    QueuesModule
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }]
})
export class AppModule {}
