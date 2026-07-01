import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_EMAIL_VERIFICATION_KEY = 'allow_pending_email_verification';

export const AllowPendingEmailVerification = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PENDING_EMAIL_VERIFICATION_KEY, true);
