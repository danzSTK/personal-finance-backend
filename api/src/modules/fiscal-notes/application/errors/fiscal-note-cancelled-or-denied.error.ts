import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteCancelledOrDeniedError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_CANCELLED_OR_DENIED;

  constructor(message = 'Fiscal note is cancelled or denied.') {
    super(message);
  }
}
