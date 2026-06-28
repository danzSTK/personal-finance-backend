import { ApplicationError } from '@/shared/application';

export class EmailMessageNotFoundError extends ApplicationError {
  readonly code = 'EMAIL_MESSAGE_NOT_FOUND';

  constructor(message = 'Email message not found.') {
    super(message);
  }
}
