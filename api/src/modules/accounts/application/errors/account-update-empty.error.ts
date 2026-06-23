import { ApplicationError } from '@/shared/application';

export class AccountUpdateEmptyError extends ApplicationError {
  readonly code = 'ACCOUNT_UPDATE_EMPTY';

  constructor(message = 'At least one field must be provided for update.') {
    super(message);
  }
}
