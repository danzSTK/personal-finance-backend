import { RetryAfterApplicationError } from '@/shared/application';

export class EmailVerificationCooldownActiveError extends RetryAfterApplicationError {
  readonly code = 'EMAIL_VERIFICATION_COOLDOWN_ACTIVE';

  constructor(retryAfterSeconds: number) {
    super('Email verification resend cooldown is active.', retryAfterSeconds);
  }
}
