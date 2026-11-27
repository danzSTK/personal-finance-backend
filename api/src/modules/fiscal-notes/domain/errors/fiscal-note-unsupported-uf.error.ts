import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { DomainError } from '@/shared/domain';

export class FiscalNoteUnsupportedUfError extends DomainError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_UNSUPPORTED_UF;

  constructor(uf?: string) {
    super(uf ? `Fiscal note UF "${uf}" is not supported.` : 'Fiscal note UF is not supported.');
  }
}
