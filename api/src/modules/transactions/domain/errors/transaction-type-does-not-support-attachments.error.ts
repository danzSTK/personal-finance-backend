import { DomainError } from '@/shared/domain';

export class TransactionTypeDoesNotSupportAttachmentsError extends DomainError {
  readonly code = 'TRANSACTION_TYPE_DOES_NOT_SUPPORT_ATTACHMENTS';

  constructor(message = 'Attachments are only supported for INCOME and EXPENSE transactions.') {
    super(message);
  }
}
