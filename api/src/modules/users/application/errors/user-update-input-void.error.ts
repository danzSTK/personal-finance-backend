import { ApplicationError } from '@/shared/application';

export class UserUpdateInputVoidError extends ApplicationError {
  readonly code = 'USER_UPDATE_INPUT_VOID';

  constructor(message = 'At least one field must be provided to update the user profile.') {
    super(message);
  }
}
