import {
  FISCAL_NOTE_DEFAULT_RETRY_AFTER_SECONDS,
  FiscalNoteErrorCodes,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { RetryAfterApplicationError } from '@/shared/application';

export class FiscalNoteRateLimitExceededError extends RetryAfterApplicationError {
  readonly code = FiscalNoteErrorCodes.FISCAL_NOTE_RATE_LIMIT_EXCEEDED;

  constructor(
    retryAfterSeconds = FISCAL_NOTE_DEFAULT_RETRY_AFTER_SECONDS,
    message = 'Fiscal note query rate limit exceeded. Please try again later.',
  ) {
    super(message, retryAfterSeconds);
  }
}
