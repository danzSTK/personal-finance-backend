import { DomainError } from '@/shared/domain';

export class InvalidAccountTemplateError extends DomainError {
  readonly code = 'INVALID_ACCOUNT_TEMPLATE';

  constructor(message = 'Invalid account template.') {
    super(message);
  }
}
