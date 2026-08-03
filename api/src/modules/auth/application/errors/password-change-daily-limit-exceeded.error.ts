import { RetryAfterApplicationError } from '@/shared/application';

export class PasswordChangeDailyLimitExceededError extends RetryAfterApplicationError {
  readonly code = 'PASSWORD_CHANGE_DAILY_LIMIT_EXCEEDED';

  constructor(retryAfterSeconds: number) {
    super('The password change daily limit has been reached.', retryAfterSeconds);
  }
}
