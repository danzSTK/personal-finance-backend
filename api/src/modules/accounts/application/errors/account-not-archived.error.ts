import { ApplicationError } from '@/shared/application';

export class AccountNotArchivedError extends ApplicationError {
  readonly code = 'ACCOUNT_NOT_ARCHIVED';

  constructor(message = 'Account is not archived.') {
    super(message);
  }
}
