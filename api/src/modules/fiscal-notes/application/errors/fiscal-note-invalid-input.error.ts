import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteInvalidInputError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_INVALID_INPUT;

  constructor(message = 'Invalid fiscal note input.') {
    super(message);
  }
}
