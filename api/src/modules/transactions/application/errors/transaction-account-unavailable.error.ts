import { ApplicationError } from '@/shared/application';

export class TransactionAccountUnavailableError extends ApplicationError {
  readonly code = 'TRANSACTION_ACCOUNT_UNAVAILABLE';

  constructor(message = 'Account cannot be used by this transaction.') {
    super(message);
  }
}
