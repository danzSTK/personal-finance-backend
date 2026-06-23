import { DomainError } from '@/shared/domain';

export class InvalidStorageKeyError extends DomainError {
  readonly code = 'INVALID_STORAGE_KEY';

  constructor(message = 'Invalid storage key.') {
    super(message);
  }
}
