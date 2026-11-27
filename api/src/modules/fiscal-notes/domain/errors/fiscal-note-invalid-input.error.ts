import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { DomainError } from '@/shared/domain';

export class FiscalNoteInvalidInputError extends DomainError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_INVALID_INPUT;

  constructor(message = 'Invalid fiscal note input.') {
    super(message);
  }
}
