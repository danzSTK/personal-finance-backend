import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteNotFoundError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_NOT_FOUND;

  constructor(message = 'Fiscal note not found.') {
    super(message);
  }
}
