import { DomainError } from '@/shared/domain';

export class TransactionAttachmentLimitExceededError extends DomainError {
  readonly code = 'TRANSACTION_ATTACHMENT_LIMIT_EXCEEDED';

  constructor(message = 'A transaction can have at most 3 active attachments.') {
    super(message);
  }
}
