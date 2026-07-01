import { ApplicationError } from '@/shared/application';

export class EmailVerificationTokenExpiredError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_TOKEN_EXPIRED';

  constructor() {
    super('Email verification token has expired.');
  }
}
