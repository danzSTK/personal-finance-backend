import { ApplicationError } from '@/shared/application';

export const MailErrorCode = {
  INVALID_PAYLOAD: 'MAIL_INVALID_PAYLOAD',
  PROVIDER_UNAVAILABLE: 'MAIL_PROVIDER_UNAVAILABLE',
  PROVIDER_REJECTED: 'MAIL_PROVIDER_REJECTED',
  PROVIDER_TIMEOUT: 'MAIL_PROVIDER_TIMEOUT',
  PROVIDER_UNKNOWN: 'MAIL_PROVIDER_UNKNOWN',
} as const;

export type MailErrorCode = (typeof MailErrorCode)[keyof typeof MailErrorCode];

export class MailError extends ApplicationError {
  constructor(
    readonly code: MailErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }

  static invalidPayload(message: string): MailError {
    return new MailError(MailErrorCode.INVALID_PAYLOAD, message, false);
  }

  static providerUnavailable(message = 'Mail provider is temporarily unavailable.'): MailError {
    return new MailError(MailErrorCode.PROVIDER_UNAVAILABLE, message, true);
  }

  static providerRejected(message = 'Mail provider rejected the message.'): MailError {
    return new MailError(MailErrorCode.PROVIDER_REJECTED, message, false);
  }

  static providerTimeout(message = 'Mail provider request timed out.'): MailError {
    return new MailError(MailErrorCode.PROVIDER_TIMEOUT, message, true);
  }

  static providerUnknown(message = 'Mail provider failed unexpectedly.'): MailError {
    return new MailError(MailErrorCode.PROVIDER_UNKNOWN, message, true);
  }
}
