import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteSefazNotFoundError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_SEFAZ_NOT_FOUND;

  constructor(message = 'Fiscal note was not found at SEFAZ.') {
    super(message);
  }
}
