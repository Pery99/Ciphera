import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { pushSubscribeSchema } from "@ciphera/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PushService } from "./push.service";

@Controller("push")
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get("vapid-public-key")
  getPublicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @UseGuards(JwtAuthGuard)
  @Post("subscribe")
  subscribe(@CurrentUser() user: { id: string }, @Body() body: unknown, @Req() request: Request) {
    const input = pushSubscribeSchema.parse(body);
    return this.push.subscribe(user.id, input, request.headers["user-agent"]);
  }

  @UseGuards(JwtAuthGuard)
  @Post("unsubscribe")
  async unsubscribe(@CurrentUser() user: { id: string }, @Body() body: { endpoint?: string } = {}) {
    await this.push.unsubscribe(user.id, body.endpoint);
    return { ok: true };
  }
}