import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InvitesService } from "./invites.service";

@Controller("invites")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: { id: string }) {
    return this.invites.create(user.id);
  }

  @Get(":token")
  preview(@Param("token") token: string) {
    return this.invites.preview(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":token/accept")
  accept(@Param("token") token: string, @CurrentUser() user: { id: string }) {
    return this.invites.accept(token, user.id);
  }
}
