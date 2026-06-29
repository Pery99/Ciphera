import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";

@Module({
  imports: [QueuesModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService]
})
export class InvitesModule {}
