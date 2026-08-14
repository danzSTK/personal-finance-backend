import { ApplicationError } from '@/shared/application';

export class PasswordChangeNotificationUserNotFoundError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_NOTIFICATION_USER_NOT_FOUND';

  constructor() {
    super('Cannot create a password change notification because the user was not found.');
  }
}
