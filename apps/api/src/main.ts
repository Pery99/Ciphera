import "reflect-metadata";
import cookieParser from "cookie-parser";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { isAllowedCorsOrigin, validateSecurityEnvironment } from "./config/security.config";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  validateSecurityEnvironment(config);

  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(config, origin)) {
        callback(null, origin ?? true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Ciphera API listening on 0.0.0.0:${port}`, "Bootstrap");
}

void bootstrap();
