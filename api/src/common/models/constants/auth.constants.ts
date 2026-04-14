import { AppStatus } from '../enums';

const csrfAllowedOrigins = (process.env.CSRF_ALLOWED_ORIGINS ?? process.env.FRONTEND_URL ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

export const AUTH_CONSTANTS = {
  cookies: {
    refreshTokenKey: 'refreshToken',
    accessTokenKey: 'accessToken',
    refreshTokenPath: '/auth',
    accessTokenPath: '/',
    secure: process.env.NODE_ENV === AppStatus.PRODUCTION,
    sameSite: 'lax',
  },
  csrf: {
    allowedOrigins: csrfAllowedOrigins,
  },

  throttles: {
    signin: {
      ttl: 60000,
      limit: 5,
      blockDuration: 600000,
    },
    signup: {
      ttl: 600000,
      limit: 10,
      blockDuration: 1800000,
    },
  },
} as const;
