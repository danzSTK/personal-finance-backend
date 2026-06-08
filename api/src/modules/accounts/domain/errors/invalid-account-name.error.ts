import { DomainError } from '@/shared/domain';

export class InvalidAccountNameError extends DomainError {
  readonly code = 'INVALID_ACCOUNT_NAME';

  constructor(message = 'Invalid account name.') {
    super(message);
  }
}
