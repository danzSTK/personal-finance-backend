import { ApplicationError } from '@/shared/application';

export class TransactionUpdateEmptyError extends ApplicationError {
  readonly code = 'TRANSACTION_UPDATE_EMPTY';

  constructor(message = 'At least one field must be provided for update.') {
    super(message);
  }
}
