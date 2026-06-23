import { ApplicationError } from '@/shared/application';

export class AccountArchivedError extends ApplicationError {
  readonly code = 'ACCOUNT_ARCHIVED';

  constructor(message = 'Archived account cannot be changed.') {
    super(message);
  }
}
