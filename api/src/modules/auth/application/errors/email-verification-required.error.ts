import { ApplicationError } from '@/shared/application';

export class EmailVerificationRequiredError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_REQUIRED';

  constructor() {
    super('Email verification is required.');
  }
}
