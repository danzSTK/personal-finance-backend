import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  // Access token secret key
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN!,
  // Refresh token secret key
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN!,
}));
