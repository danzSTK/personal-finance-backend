import { ApplicationError } from '@/shared/application';

export class CategoryInvalidListQueryError extends ApplicationError {
  readonly code = 'CATEGORY_INVALID_LIST_QUERY';

  constructor(message = 'Invalid category list query.') {
    super(message);
  }
}
