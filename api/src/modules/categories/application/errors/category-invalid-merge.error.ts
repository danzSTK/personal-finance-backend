import { ApplicationError } from '@/shared/application';

export class CategoryInvalidMergeError extends ApplicationError {
  readonly code = 'CATEGORY_INVALID_MERGE';

  constructor(message = 'Invalid category merge.') {
    super(message);
  }
}
