import { ApplicationError } from '@/shared/application';

export class CategoryNameAlreadyExistsError extends ApplicationError {
  readonly code = 'CATEGORY_NAME_ALREADY_EXISTS';

  constructor(message = 'An active category with this name already exists for this type.') {
    super(message);
  }
}
