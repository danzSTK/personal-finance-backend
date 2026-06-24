import { ApplicationError } from '@/shared/application';

export class TransactionCategoryIncompatibleError extends ApplicationError {
  readonly code = 'TRANSACTION_CATEGORY_INCOMPATIBLE';

  constructor(message = 'Category is incompatible with transaction type.') {
    super(message);
  }
}
