import { ApplicationError } from '@/shared/application';

export class UserNotFoundError extends ApplicationError {
  readonly code = 'USER_NOT_FOUND';

  constructor(message = 'User not found.') {
    super(message);
  }
}
