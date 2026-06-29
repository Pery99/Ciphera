import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { createConversationSchema } from "@ciphera/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ConversationsService } from "./conversations.service";

@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.conversations.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.conversations.createDirect(user.id, createConversationSchema.parse(body).peerUsername);
  }

  @Post(":conversationId/read")
  markRead(@CurrentUser() user: { id: string }, @Param("conversationId") conversationId: string) {
    return this.conversations.markRead(user.id, conversationId);
  }
}
