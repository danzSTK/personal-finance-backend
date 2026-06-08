import { ApplicationError } from '@/shared/application';

export class AccountAlreadyDefaultError extends ApplicationError {
  readonly code = 'ACCOUNT_ALREADY_DEFAULT';

  constructor(message = 'Account is already set as default.') {
    super(message);
  }
}
