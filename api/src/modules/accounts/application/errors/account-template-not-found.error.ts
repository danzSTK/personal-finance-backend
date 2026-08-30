import { ApplicationError } from '@/shared/application';

export class AccountTemplateNotFoundError extends ApplicationError {
  readonly code = 'ACCOUNT_TEMPLATE_NOT_FOUND';

  constructor(message = 'Account template not found.') {
    super(message);
  }
}
