import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  createUploadSignature() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException("Media uploads are not configured.");
    }
    const publicId = `ciphera/${crypto.randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      cloudName,
      apiKey,
      publicId,
      timestamp,
      signature
    };
  }
}
