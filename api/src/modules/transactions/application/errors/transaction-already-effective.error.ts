import { ApplicationError } from '@/shared/application';

export class TransactionAlreadyEffectiveError extends ApplicationError {
  readonly code = 'TRANSACTION_ALREADY_EFFECTIVE';

  constructor(message = 'Transaction is already effective.') {
    super(message);
  }
}
