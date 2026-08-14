import { RetryAfterApplicationError } from '@/shared/application';

export class PasswordChangeBlockedError extends RetryAfterApplicationError {
  readonly code = 'PASSWORD_CHANGE_BLOCKED';

  constructor(retryAfterSeconds: number) {
    super('Password change is temporarily blocked.', retryAfterSeconds);
  }
}
