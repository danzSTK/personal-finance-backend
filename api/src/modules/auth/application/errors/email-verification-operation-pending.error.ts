import { RetryAfterApplicationError } from '@/shared/application';

export class EmailVerificationOperationPendingError extends RetryAfterApplicationError {
  readonly code = 'EMAIL_VERIFICATION_OPERATION_PENDING';

  constructor(retryAfterSeconds: number) {
    super('Another email verification resend operation is already in progress.', retryAfterSeconds);
  }
}
