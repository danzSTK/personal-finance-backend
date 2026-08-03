import { ApplicationError } from '@/shared/application';

export class PasswordChangeEmailProviderRequiredError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED';

  constructor() {
    super('A local email password is required for this operation.');
  }
}
