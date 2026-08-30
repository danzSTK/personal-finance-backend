import { ApplicationError } from '@/shared/application';

export class AccountTemplateInputConflictError extends ApplicationError {
  readonly code = 'ACCOUNT_TEMPLATE_INPUT_CONFLICT';

  constructor(message = 'template cannot be combined with legacy color or icon fields.') {
    super(message);
  }
}
