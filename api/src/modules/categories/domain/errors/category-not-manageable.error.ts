import { DomainError } from '@/shared/domain';

export class CategoryNotManageableError extends DomainError {
  readonly code = 'CATEGORY_NOT_MANAGEABLE';

  constructor(message = 'Category cannot be managed by the user.') {
    super(message);
  }
}
