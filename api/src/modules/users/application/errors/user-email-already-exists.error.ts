import { ApplicationError } from '@/shared/application';

export class UserEmailAlreadyExistsError extends ApplicationError {
  readonly code = 'USER_EMAIL_ALREADY_EXISTS';

  constructor(email: string) {
    super(`User with email "${email}" already exists.`);
  }
}
