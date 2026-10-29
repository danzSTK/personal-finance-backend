import { DomainError } from '@/shared/domain';

export class InvalidAttachmentPositionError extends DomainError {
  readonly code = 'INVALID_ATTACHMENT_POSITION';

  constructor(message = 'Invalid attachment position.') {
    super(message);
  }
}
