import { DomainError } from '@/shared/domain';

export class InvalidTransactionError extends DomainError {
  readonly code = 'INVALID_TRANSACTION';

  constructor(message = 'Invalid transaction.') {
    super(message);
  }
}
