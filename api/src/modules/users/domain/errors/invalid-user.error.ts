import { DomainError } from '@/shared/domain';

export class InvalidUserError extends DomainError {
  readonly code = 'INVALID_USER';

  constructor(message = 'Invalid user.') {
    super(message);
  }
}
