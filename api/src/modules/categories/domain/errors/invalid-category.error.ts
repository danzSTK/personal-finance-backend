import { DomainError } from '@/shared/domain';

export class InvalidCategoryError extends DomainError {
  readonly code = 'INVALID_CATEGORY';

  constructor(message = 'Invalid category.') {
    super(message);
  }
}
