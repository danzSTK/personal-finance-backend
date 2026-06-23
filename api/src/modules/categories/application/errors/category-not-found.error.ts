import { ApplicationError } from '@/shared/application';

export class CategoryNotFoundError extends ApplicationError {
  readonly code = 'CATEGORY_NOT_FOUND';

  constructor(message = 'Category not found.') {
    super(message);
  }
}
