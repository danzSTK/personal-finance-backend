import { MailDefaults, MailProviderName } from '@/shared/mail/constants/mail.constants';
import { registerAs } from '@nestjs/config';

export interface MailConfig {
  enabled: boolean;
  provider: MailProviderName;
  defaultSender: {
    email?: string;
    name?: string;
  };
  brevo: {
    apiKey?: string;
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
    templateIds: Readonly<Record<string, number | undefined>>;
  };
}

const readBoolean = (key: string, defaultValue: boolean): boolean => {
  const rawValue = process.env[key];

  if (rawValue === undefined) {
    return defaultValue;
  }

  return rawValue.toLowerCase() === 'true';
};

const readOptionalString = (key: string): string | undefined => {
  const value = process.env[key];

  return value && value.length > 0 ? value : undefined;
};

const readNumber = (key: string, defaultValue: number): number => {
  const rawValue = process.env[key];

  return rawValue === undefined ? defaultValue : Number(rawValue);
};

const readOptionalNumber = (key: string): number | undefined => {
  const rawValue = process.env[key];

  return rawValue === undefined || rawValue.length === 0 ? undefined : Number(rawValue);
};

const readProvider = (): MailProviderName => {
  const provider = process.env.MAIL_PROVIDER;

  return provider === MailProviderName.BREVO ? MailProviderName.BREVO : MailProviderName.NOOP;
};

export default registerAs(
  'mail',
  (): MailConfig => ({
    enabled: readBoolean('MAIL_ENABLED', MailDefaults.enabled),
    provider: readProvider(),
    defaultSender: {
      email: readOptionalString('MAIL_DEFAULT_FROM_EMAIL'),
      name: readOptionalString('MAIL_DEFAULT_FROM_NAME'),
    },
    brevo: {
      apiKey: readOptionalString('BREVO_API_KEY'),
      baseUrl: process.env.BREVO_API_BASE_URL ?? MailDefaults.brevoBaseUrl,
      timeoutMs: readNumber('BREVO_API_TIMEOUT_MS', MailDefaults.brevoTimeoutMs),
      maxRetries: readNumber('BREVO_API_MAX_RETRIES', MailDefaults.brevoMaxRetries),
      templateIds: {
        'welcome-email:v1': readOptionalNumber('BREVO_TEMPLATE_WELCOME_EMAIL_V1_ID'),
        'email-verification:v1': readOptionalNumber('BREVO_TEMPLATE_EMAIL_VERIFICATION_V1_ID'),
        'password-changed:v1': readOptionalNumber('BREVO_TEMPLATE_PASSWORD_CHANGED_V1_ID'),
        'password-change-blocked:v1': readOptionalNumber('BREVO_TEMPLATE_PASSWORD_CHANGE_BLOCKED_V1_ID'),
      },
    },
  }),
);
