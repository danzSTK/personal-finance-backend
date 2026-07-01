import { ApplicationError } from '@/shared/application';

export class EmailVerificationCooldownActiveError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_COOLDOWN_ACTIVE';

  constructor() {
    super('Email verification resend cooldown is active.');
  }
}
