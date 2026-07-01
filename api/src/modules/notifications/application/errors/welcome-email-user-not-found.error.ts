import { ApplicationError } from '@/shared/application';

export class WelcomeEmailUserNotFoundError extends ApplicationError {
  readonly code = 'WELCOME_EMAIL_USER_NOT_FOUND';

  constructor() {
    super('Cannot create welcome email because the user was not found.');
  }
}
