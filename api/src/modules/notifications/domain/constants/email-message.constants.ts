export const EmailMessageStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
  CANCELED: 'CANCELED',
} as const;

export type EmailMessageStatus = (typeof EmailMessageStatus)[keyof typeof EmailMessageStatus];

export const EmailMessageType = {
  WELCOME: 'WELCOME',
} as const;

export type EmailMessageType = (typeof EmailMessageType)[keyof typeof EmailMessageType];

export const EmailProviderKey = {
  BREVO: 'brevo',
} as const;

export type EmailProviderKey = (typeof EmailProviderKey)[keyof typeof EmailProviderKey];

export const EmailTemplateKey = {
  WELCOME: 'welcome-email',
} as const;

export type EmailTemplateKey = (typeof EmailTemplateKey)[keyof typeof EmailTemplateKey];

export const BrevoTemplateId = {
  WELCOME: '2',
} as const;

export const EmailMessageLimits = {
  recipientEmailMaxLength: 320,
  recipientNameMaxLength: 120,
  providerMaxLength: 50,
  templateKeyMaxLength: 100,
  providerTemplateIdMaxLength: 100,
  idempotencyKeyMaxLength: 255,
  statusMaxLength: 30,
  providerMessageIdMaxLength: 255,
  lastErrorCodeMaxLength: 100,
  lastErrorMessageMaxLength: 2_000,
} as const;

export const WelcomeEmailTemplateParams = {
  FIRST_NAME: 'first_name',
  DASHBOARD_URL: 'dashboard_url',
  SUPPORT_URL: 'support_url',
  SUPPORT_URL_LABEL: 'support_url_label',
  PREFERENCES_URL: 'preferences_url',
} as const;

export interface WelcomeEmailParams extends Record<string, unknown> {
  first_name: string;
  dashboard_url: string;
  support_url: string;
  support_url_label: string;
  preferences_url: string;
}

export const WelcomeEmailIdempotencyKeys = {
  user: (userId: string): string => `email:welcome:user:${userId}`,
} as const;
