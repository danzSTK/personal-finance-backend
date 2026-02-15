export const AUTH_CONSTANTS = {
  cookies: {
    refreshTokenKey: 'refreshToken',
    accessTokenKey: 'accessToken',
    secure: process.env.NODE_ENV === 'production',
  },
} as const;
