import { ApplicationError } from '@/shared/application';

export class CurrentPasswordInvalidError extends ApplicationError {
  readonly code = 'CURRENT_PASSWORD_INVALID';

  constructor() {
    super('The current password is invalid.');
  }
}
