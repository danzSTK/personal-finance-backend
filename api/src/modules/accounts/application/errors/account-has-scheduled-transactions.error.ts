import { ApplicationError } from '@/shared/application';

export class AccountHasScheduledTransactionsError extends ApplicationError {
  readonly code = 'ACCOUNT_HAS_SCHEDULED_TRANSACTIONS';

  constructor(message = 'Account with scheduled future transactions cannot be archived.') {
    super(message);
  }
}
