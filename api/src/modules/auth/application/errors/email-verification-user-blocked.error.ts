import { ApplicationError } from '@/shared/application';

export class EmailVerificationUserBlockedError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_USER_BLOCKED';

  constructor() {
    super('Blocked users cannot verify email.');
  }
}
