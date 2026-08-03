import { RetryAfterApplicationError } from '@/shared/application';

export class PasswordChangeCooldownActiveError extends RetryAfterApplicationError {
  readonly code = 'PASSWORD_CHANGE_COOLDOWN_ACTIVE';

  constructor(retryAfterSeconds: number) {
    super('Password change cooldown is active.', retryAfterSeconds);
  }
}
