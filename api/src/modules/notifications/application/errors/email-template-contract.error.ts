import { ApplicationError } from '@/shared/application';

export const EmailTemplateContractErrorCode = {
  UNKNOWN: 'EMAIL_TEMPLATE_UNKNOWN',
  VERSION_UNSUPPORTED: 'EMAIL_TEMPLATE_VERSION_UNSUPPORTED',
  PARAMS_INVALID: 'EMAIL_TEMPLATE_PARAMS_INVALID',
} as const;

export type EmailTemplateContractErrorCode =
  (typeof EmailTemplateContractErrorCode)[keyof typeof EmailTemplateContractErrorCode];

export class EmailTemplateContractError extends ApplicationError {
  readonly retryable = false;

  private constructor(
    readonly code: EmailTemplateContractErrorCode,
    message: string,
  ) {
    super(message);
  }

  static unknown(templateKey: string): EmailTemplateContractError {
    return new EmailTemplateContractError(
      EmailTemplateContractErrorCode.UNKNOWN,
      `Unknown email template "${templateKey}".`,
    );
  }

  static versionUnsupported(templateKey: string, templateVersion: number): EmailTemplateContractError {
    return new EmailTemplateContractError(
      EmailTemplateContractErrorCode.VERSION_UNSUPPORTED,
      `Email template "${templateKey}" does not support version ${templateVersion}.`,
    );
  }

  static paramsInvalid(templateKey: string, templateVersion: number): EmailTemplateContractError {
    return new EmailTemplateContractError(
      EmailTemplateContractErrorCode.PARAMS_INVALID,
      `Email template params are invalid for "${templateKey}" version ${templateVersion}.`,
    );
  }
}
