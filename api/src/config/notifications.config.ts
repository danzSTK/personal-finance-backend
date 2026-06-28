import { registerAs } from '@nestjs/config';

export interface NotificationsConfig {
  dashboardPath: string;
  emailPreferencesPath: string;
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
    supportUrl: process.env.SUPPORT_URL ?? `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/support`,
    supportUrlLabel: process.env.SUPPORT_URL_LABEL ?? 'Central de ajuda',
  }),
);
