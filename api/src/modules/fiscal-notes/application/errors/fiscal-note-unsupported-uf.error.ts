import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { ApplicationError } from '@/shared/application';

export class FiscalNoteUnsupportedUfError extends ApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_UNSUPPORTED_UF;

  constructor(uf?: string) {
    super(uf ? `Fiscal note UF "${uf}" is not supported.` : 'Fiscal note UF is not supported.');
  }
}
