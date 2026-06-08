import { ApplicationError } from '@/shared/application';

export class CategoryUpdateEmptyError extends ApplicationError {
  readonly code = 'CATEGORY_UPDATE_EMPTY';

  constructor(message = 'At least one field must be provided for update.') {
    super(message);
  }
}
