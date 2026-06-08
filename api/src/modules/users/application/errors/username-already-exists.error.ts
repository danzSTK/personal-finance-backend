import { ApplicationError } from '@/shared/application';

export class UsernameAlreadyExistsError extends ApplicationError {
  readonly code = 'USERNAME_ALREADY_EXISTS';

  constructor(username: string) {
    super(`Username "${username}" already exists.`);
  }
}
