import { DomainError } from '@/shared/domain';

export const TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE_CODE = 'TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE';

export class TransactionTypeDoesNotSupportFiscalNoteError extends DomainError {
  readonly code = TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE_CODE;

  constructor(message = 'Only expense transactions support fiscal notes.') {
    super(message);
  }
}
