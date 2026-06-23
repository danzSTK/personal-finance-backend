import { DomainError } from '@/shared/domain';

export class InvalidUsernameFormatError extends DomainError {
  readonly code = 'INVALID_USERNAME_FORMAT';

  constructor(message = 'Invalid username format.') {
    super(message);
  }
}
