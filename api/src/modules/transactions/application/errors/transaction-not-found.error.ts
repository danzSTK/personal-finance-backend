import { ApplicationError } from '@/shared/application';

export class TransactionNotFoundError extends ApplicationError {
  readonly code = 'TRANSACTION_NOT_FOUND';

  constructor(message = 'Transaction not found.') {
    super(message);
  }
}
