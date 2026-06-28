import { DomainError } from '@/shared/domain';

export class InvalidEmailMessageError extends DomainError {
  readonly code = 'INVALID_EMAIL_MESSAGE';

  constructor(message = 'Invalid email message.') {
    super(message);
  }
}
