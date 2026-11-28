import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class TransactionAlreadyHasFiscalNoteError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.TRANSACTION_ALREADY_HAS_FISCAL_NOTE;

  constructor(
    readonly existingFiscalNoteId: string,
    message = 'Transaction already has an active fiscal note.',
  ) {
    super(message);
  }

  get details(): Record<string, unknown> {
    return {
      existingFiscalNoteId: this.existingFiscalNoteId,
    };
  }
}
