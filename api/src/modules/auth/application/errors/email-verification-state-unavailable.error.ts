import { ApplicationError } from '@/shared/application';

export class EmailVerificationStateUnavailableError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_STATE_UNAVAILABLE';

  constructor() {
    super('Email verification resend state is temporarily unavailable.');
  }
}
