import { ApplicationError } from '@/shared/application';

export class EmailVerificationTokenInvalidError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_TOKEN_INVALID';

  constructor() {
    super('Email verification token is invalid.');
  }
}
