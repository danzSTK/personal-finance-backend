import { DomainError } from '@/shared/domain';

export class TransactionInvalidStateTransitionError extends DomainError {
  readonly code = 'TRANSACTION_INVALID_STATE_TRANSITION';

  constructor(message = 'Invalid transaction state transition.') {
    super(message);
  }
}
