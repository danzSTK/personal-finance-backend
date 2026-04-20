import { AUTH_CONSTANTS } from '@/common/models/constants';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const RefreshToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<AuthRequest>();

  return request.cookies?.[AUTH_CONSTANTS.cookies.refreshTokenKey];
});
