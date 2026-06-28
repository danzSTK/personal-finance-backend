import { BrevoError, BrevoTimeoutError } from '@getbrevo/brevo';
import { MailError } from './mail-error';

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class MailErrorMapper {
  static fromProviderError(error: unknown): MailError {
    if (error instanceof MailError) {
      return error;
    }

    if (error instanceof BrevoTimeoutError) {
      return MailError.providerTimeout();
    }

    if (error instanceof BrevoError) {
      return this.fromBrevoError(error);
    }

    return MailError.providerUnknown();
  }

  private static fromBrevoError(error: BrevoError): MailError {
    const statusCode = error.statusCode;

    if (statusCode && RETRYABLE_STATUS_CODES.has(statusCode)) {
      return MailError.providerUnavailable();
    }

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return MailError.providerRejected();
    }

    return MailError.providerUnknown();
  }
}
