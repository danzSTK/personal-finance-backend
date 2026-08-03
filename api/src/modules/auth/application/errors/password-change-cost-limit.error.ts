import { RetryAfterApplicationError } from '@/shared/application';

export class PasswordChangeCostLimitedError extends RetryAfterApplicationError {
  readonly code = 'PASSWORD_CHANGE_COST_LIMITED';

  constructor(retryAfterSeconds: number) {
    super('Too many password change requests.', retryAfterSeconds);
  }
}
