import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type JwtUser = { id: string; username: string };

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtUser => {
  const request = context.switchToHttp().getRequest<{ user: JwtUser }>();
  return request.user;
});
