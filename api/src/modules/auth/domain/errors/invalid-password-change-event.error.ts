import { DomainError } from '@/shared/domain';

export class InvalidPasswordChangeEventError extends DomainError {
  readonly code = 'INVALID_PASSWORD_CHANGE_EVENT';

  constructor(message = 'Invalid password change event.') {
    super(message);
  }
}
