import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  url: process.env.APP_URL!,
  nodeEnv: process.env.NODE_ENV!,
  frontendUrl: process.env.FRONTEND_URL!,
  csrfAllowedOrigins: process.env.CSRF_ALLOWED_ORIGINS,
}));
