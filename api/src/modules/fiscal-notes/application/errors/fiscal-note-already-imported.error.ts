import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteAlreadyImportedError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_ALREADY_IMPORTED;

  constructor(
    readonly existingTransactionId: string,
    readonly existingFiscalNoteId: string,
    message = 'Fiscal note has already been imported.',
  ) {
    super(message);
  }

  get details(): Record<string, unknown> {
    return {
      existingTransactionId: this.existingTransactionId,
      existingFiscalNoteId: this.existingFiscalNoteId,
    };
  }
}
