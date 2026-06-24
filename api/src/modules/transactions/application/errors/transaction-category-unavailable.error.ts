import { ApplicationError } from '@/shared/application';

export class TransactionCategoryUnavailableError extends ApplicationError {
  readonly code = 'TRANSACTION_CATEGORY_UNAVAILABLE';

  constructor(message = 'Category cannot be used by this transaction.') {
    super(message);
  }
}
