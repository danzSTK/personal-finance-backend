import { ApplicationError } from '@/shared/application';

export class TransactionAttachmentFilesEmptyError extends ApplicationError {
  readonly code = 'TRANSACTION_ATTACHMENT_FILES_EMPTY';

  constructor(message = 'At least one file is required.') {
    super(message);
  }
}
