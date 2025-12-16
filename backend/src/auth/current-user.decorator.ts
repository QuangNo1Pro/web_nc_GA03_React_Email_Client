import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 🔐 Decorator để extract JWT payload từ request
 * Sử dụng: @CurrentUser() user: CurrentUserPayload
 * 
 * Payload được set bởi JwtAuthGuard
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
