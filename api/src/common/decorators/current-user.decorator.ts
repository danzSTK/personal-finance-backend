import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { User } from '@/modules/users/entities/user.entity';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<AuthRequest>();
  const user = request.user;

  if (!user) {
    throw new Error('User not found in request');
  }

  return user;
});
