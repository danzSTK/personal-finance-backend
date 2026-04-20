import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AUTH_CONSTANTS } from '@/common/models/constants';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';

export const RefreshToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): unknown => {
  const request = ctx.switchToHttp().getRequest<AuthRequest>();

  return request.cookies?.[AUTH_CONSTANTS.cookies.refreshTokenKey];
});
