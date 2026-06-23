import { DomainError } from '@/shared/domain';

export class InvalidAccountError extends DomainError {
  readonly code = 'INVALID_ACCOUNT';

  constructor(message = 'Invalid account.') {
    super(message);
  }
}
