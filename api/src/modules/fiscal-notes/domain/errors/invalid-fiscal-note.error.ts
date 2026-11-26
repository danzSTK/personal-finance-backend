import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { DomainError } from '@/shared/domain';

export class InvalidFiscalNoteError extends DomainError {
  readonly code = FiscalNoteErrorCodes.INVALID_FISCAL_NOTE;

  constructor(message = 'Invalid fiscal note.') {
    super(message);
  }
}
