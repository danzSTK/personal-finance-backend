import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  default: {
    ttl: Number(process.env.THROTTLE_DEFAULT_TTL) || 60000,
    limit: Number(process.env.THROTTLE_DEFAULT_LIMIT) || 20,
  },
  auth: {
    ttl: Number(process.env.THROTTLE_AUTH_TTL) || 60000,
    limit: Number(process.env.THROTTLE_AUTH_LIMIT) || 5,
  },
}));
