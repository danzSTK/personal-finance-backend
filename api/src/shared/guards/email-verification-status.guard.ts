import { ALLOW_PENDING_EMAIL_VERIFICATION_KEY } from '@/common/decorators/allow-pending-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/common/decorators/is-public.decorator';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { UserStatus } from '@/common/models/enums';
import { EmailVerificationRequiredError } from '@/modules/auth/application/errors';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class EmailVerificationStatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_EMAIL_VERIFICATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowPending) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user || user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      return true;
    }

    throw new EmailVerificationRequiredError();
  }
}
