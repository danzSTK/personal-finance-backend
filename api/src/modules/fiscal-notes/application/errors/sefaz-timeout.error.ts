import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class SefazTimeoutError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.SEFAZ_TIMEOUT;

  constructor(message = 'SEFAZ request timed out.') {
    super(message);
  }
}
