import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MessagesService } from "./messages.service";

@UseGuards(JwtAuthGuard)
@Controller("conversations/:conversationId/messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }, @Param("conversationId") conversationId: string) {
    return this.messages.list(user.id, conversationId);
  }
}
