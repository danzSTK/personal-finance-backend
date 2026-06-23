import { DomainError } from '@/shared/domain';

export class TechnicalCategoryCannotBeCreatedError extends DomainError {
  readonly code = 'TECHNICAL_CATEGORY_CANNOT_BE_CREATED';

  constructor(message = 'Technical category types cannot be created manually.') {
    super(message);
  }
}
