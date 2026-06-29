import { Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MediaService } from "./media.service";

@UseGuards(JwtAuthGuard)
@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload-signature")
  createUploadSignature() {
    return this.media.createUploadSignature();
  }
}
