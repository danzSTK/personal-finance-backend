import { DomainError } from '@/shared/domain';

export class AccountArchivedMutationError extends DomainError {
  readonly code = 'ACCOUNT_ARCHIVED_MUTATION';

  constructor(message = 'Archived account cannot be changed.') {
    super(message);
  }
}
