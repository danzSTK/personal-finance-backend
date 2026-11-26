import {
  FISCAL_NOTE_DEFAULT_RETRY_AFTER_SECONDS,
  FiscalNoteErrorCodes,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { RetryAfterApplicationError } from '@/shared/application';

export class SefazTemporarilyUnavailableError extends RetryAfterApplicationError {
  readonly code = FiscalNoteErrorCodes.SEFAZ_TEMPORARILY_UNAVAILABLE;

  constructor(
    retryAfterSeconds = FISCAL_NOTE_DEFAULT_RETRY_AFTER_SECONDS,
    message = 'SEFAZ service is temporarily unavailable. Please try again later.',
  ) {
    super(message, retryAfterSeconds);
  }
}
