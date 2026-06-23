import { ApplicationError } from '@/shared/application';

export class CategoryHasTransactionsError extends ApplicationError {
  readonly code = 'CATEGORY_HAS_TRANSACTIONS';

  constructor(message = 'Category has transactions and must be merged before deletion.') {
    super(message);
  }
}
