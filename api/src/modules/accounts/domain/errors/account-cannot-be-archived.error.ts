import { DomainError } from '@/shared/domain';

export class AccountCannotBeArchivedError extends DomainError {
  readonly code = 'ACCOUNT_CANNOT_BE_ARCHIVED';

  constructor(message = 'Account cannot be archived.') {
    super(message);
  }
}
