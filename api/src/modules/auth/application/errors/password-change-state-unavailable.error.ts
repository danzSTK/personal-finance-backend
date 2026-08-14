import { ApplicationError } from '@/shared/application';

export class PasswordChangeStateUnavailableError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_STATE_UNAVAILABLE';

  constructor() {
    super('Password change state is temporarily unavailable.');
  }
}
