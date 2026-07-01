import { registerAs } from '@nestjs/config';

export interface NotificationsConfig {
  dashboardPath: string;
  emailPreferencesPath: string;
  emailVerificationPath: string;
  emailVerificationProviderTemplateId: string;
  emailVerificationTokenTtlMinutes: number;
  emailVerificationResendCooldownMinutes: number;
  emailVerificationDailyLimit: number;
  supportUrl: string;
  supportUrlLabel: string;
}

const normalizePath = (value: string): string => {
  const trimmed = value.trim();

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `/${trimmed}`;
};

export default registerAs(
  'notifications',
  (): NotificationsConfig => ({
    dashboardPath: normalizePath(process.env.NOTIFICATIONS_DASHBOARD_PATH ?? '/dashboard'),
    emailPreferencesPath: normalizePath(
      process.env.NOTIFICATIONS_EMAIL_PREFERENCES_PATH ?? '/settings/email-preferences',
    ),
    emailVerificationPath: normalizePath(process.env.NOTIFICATIONS_EMAIL_VERIFICATION_PATH ?? '/verification-email'),
    emailVerificationProviderTemplateId: process.env.NOTIFICATIONS_EMAIL_VERIFICATION_PROVIDER_TEMPLATE_ID ?? '3',
    emailVerificationTokenTtlMinutes: Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES ?? 15),
    emailVerificationResendCooldownMinutes: Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES ?? 60),
    emailVerificationDailyLimit: Number(process.env.EMAIL_VERIFICATION_DAILY_LIMIT ?? 5),
    supportUrl: process.env.SUPPORT_URL ?? `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/support`,
    supportUrlLabel: process.env.SUPPORT_URL_LABEL ?? 'Central de ajuda',
  }),
);
