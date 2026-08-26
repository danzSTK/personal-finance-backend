import { RetryAfterApplicationError } from '@/shared/application';

export class EmailVerificationDailyLimitExceededError extends RetryAfterApplicationError {
  readonly code = 'EMAIL_VERIFICATION_DAILY_LIMIT_EXCEEDED';

  constructor(retryAfterSeconds: number) {
    super('Email verification daily limit exceeded.', retryAfterSeconds);
  }
}
