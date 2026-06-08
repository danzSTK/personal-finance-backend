import { ApplicationError } from '@/shared/application';

export class AccountNotFoundError extends ApplicationError {
  readonly code = 'ACCOUNT_NOT_FOUND';

  constructor(message = 'Account not found.') {
    super(message);
  }
}
