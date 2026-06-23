import { ApplicationError } from '@/shared/application';

export class AccountMustRemainActiveError extends ApplicationError {
  readonly code = 'ACCOUNT_MUST_REMAIN_ACTIVE';

  constructor(message = 'At least one active account must remain.') {
    super(message);
  }
}
