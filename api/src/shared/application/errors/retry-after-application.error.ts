import { ApplicationError } from '@/shared/application/errors/application-error';

export abstract class RetryAfterApplicationError extends ApplicationError {
  readonly retryAfterSeconds: number;

  protected constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = RetryAfterApplicationError.normalizedRetryAfter(retryAfterSeconds);
  }

  get details(): Record<string, unknown> {
    return {
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }

  private static normalizedRetryAfter(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError('retryAfterSeconds must be a positive number');
    }

    return Math.max(1, Math.ceil(value));
  }
}
