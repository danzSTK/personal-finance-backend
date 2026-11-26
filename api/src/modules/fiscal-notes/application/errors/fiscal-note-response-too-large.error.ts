import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteResponseTooLargeError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_RESPONSE_TOO_LARGE;

  constructor(message = 'SEFAZ response exceeded maximum allowed size.') {
    super(message);
  }
}
