import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteParseFailedError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_PARSE_FAILED;

  constructor(message = 'Failed to parse fiscal note response from SEFAZ.') {
    super(message);
  }
}
