import { ApplicationError } from '@/shared/application';

export class TransactionAttachmentNotFoundError extends ApplicationError {
  readonly code = 'TRANSACTION_ATTACHMENT_NOT_FOUND';

  constructor(message = 'Transaction attachment not found.') {
    super(message);
  }
}
