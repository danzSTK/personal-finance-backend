import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { DomainError } from '@/shared/domain';

export class FiscalNoteHomologationNotAllowedError extends DomainError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED;

  constructor(message = 'Fiscal notes issued in homologation environment are not allowed.') {
    super(message);
  }
}
