import { AppStatus } from '../enums';

export const AUTH_CONSTANTS = {
  cookies: {
    refreshTokenKey: 'refreshToken',
    accessTokenKey: 'accessToken',
    secure: process.env.NODE_ENV === AppStatus.PRODUCTION,
    sameSite: 'lax',
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
