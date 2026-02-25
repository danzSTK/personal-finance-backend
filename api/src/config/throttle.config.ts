import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  default: {
    ttl: Number(process.env.THROTTLE_DEFAULT_TTL) ? Number(process.env.THROTTLE_DEFAULT_TTL) : null,
    limit: Number(process.env.THROTTLE_DEFAULT_LIMIT) ? Number(process.env.THROTTLE_DEFAULT_LIMIT) : null,
  },
  auth: {
    signin: {
      ttl: Number(process.env.THROTTLE_AUTH_SIGNIN_TTL) ? Number(process.env.THROTTLE_AUTH_SIGNIN_TTL) : null,
      limit: Number(process.env.THROTTLE_AUTH_SIGNIN_LIMIT) ? Number(process.env.THROTTLE_AUTH_SIGNIN_LIMIT) : null,
      blockDuration: Number(process.env.THROTTLE_AUTH_SIGNIN_BLOCKED_TTL)
        ? Number(process.env.THROTTLE_AUTH_SIGNIN_BLOCKED_TTL)
        : null,
    },
    signup: {
      ttl: Number(process.env.THROTTLE_AUTH_SIGNUP_TTL) ? Number(process.env.THROTTLE_AUTH_SIGNUP_TTL) : null,
      limit: Number(process.env.THROTTLE_AUTH_SIGNUP_LIMIT) ? Number(process.env.THROTTLE_AUTH_SIGNUP_LIMIT) : null,
      blockDuration: Number(process.env.THROTTLE_AUTH_SIGNUP_BLOCKED_TTL)
        ? Number(process.env.THROTTLE_AUTH_SIGNUP_BLOCKED_TTL)
        : null,
    },
  },
}));
