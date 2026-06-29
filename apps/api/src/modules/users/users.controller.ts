import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UsersService } from "./users.service";

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: { id: string }) {
    return this.users.getProfile(user.id);
  }

  @Get("search")
  search(@Query("username") username = "", @CurrentUser() user: { id: string }) {
    return this.users.search(username, user.id);
  }
}
