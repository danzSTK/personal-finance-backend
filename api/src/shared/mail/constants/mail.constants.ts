export const MailDefaults = {
  enabled: false,
  provider: 'noop',
  brevoBaseUrl: 'https://api.brevo.com/v3',
  brevoTimeoutMs: 10_000,
  brevoMaxRetries: 2,
} as const;

export const MailProviderName = {
  BREVO: 'brevo',
  NOOP: 'noop',
} as const;

export type MailProviderName = (typeof MailProviderName)[keyof typeof MailProviderName];
