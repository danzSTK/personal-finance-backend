import { ApplicationError } from '@/shared/application';

export class CategoryNotManageableApplicationError extends ApplicationError {
  readonly code = 'CATEGORY_NOT_MANAGEABLE';

  constructor(message = 'Category cannot be managed by the user.') {
    super(message);
  }
}
