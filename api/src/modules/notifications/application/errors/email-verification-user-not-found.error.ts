import { ApplicationError } from '@/shared/application';

export class EmailVerificationUserNotFoundError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_USER_NOT_FOUND';

  constructor() {
    super('Email verification user was not found.');
  }
}
