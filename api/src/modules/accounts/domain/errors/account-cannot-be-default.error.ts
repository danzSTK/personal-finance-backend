import { DomainError } from '@/shared/domain';

export class AccountCannotBeDefaultError extends DomainError {
  readonly code = 'ACCOUNT_CANNOT_BE_DEFAULT';

  constructor(message = 'Account cannot be set as default.') {
    super(message);
  }
}
