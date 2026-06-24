import { DomainError } from '@/shared/domain';

export class TransactionCannotDeleteTransferError extends DomainError {
  readonly code = 'TRANSACTION_CANNOT_DELETE_TRANSFER';

  constructor(message = 'Transfer transactions cannot be deleted in V0.') {
    super(message);
  }
}
