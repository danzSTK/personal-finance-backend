import { ApplicationError } from '@/shared/application';

export class NewPasswordMustDifferError extends ApplicationError {
  readonly code = 'NEW_PASSWORD_MUST_DIFFER';

  constructor() {
    super('The new password must be different from the current password.');
  }
}
