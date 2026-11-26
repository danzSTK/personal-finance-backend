import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteHomologationNotAllowedError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED;

  constructor(message = 'Fiscal notes issued in homologation environment are not allowed.') {
    super(message);
  }
}
