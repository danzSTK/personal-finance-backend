import { RetryAfterApplicationError } from '@/shared/application';

export class PasswordChangeOperationPendingError extends RetryAfterApplicationError {
  readonly code = 'PASSWORD_CHANGE_OPERATION_PENDING';

  constructor(retryAfterSeconds: number) {
    super('Another password change operation is already in progress.', retryAfterSeconds);
  }
}
