import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  default: {
    ttl: Number(process.env.THROTTLE_DEFAULT_TTL),
    limit: Number(process.env.THROTTLE_DEFAULT_LIMIT),
  },
  auth: {
    signin: {
      ttl: Number(process.env.THROTTLE_AUTH_SIGNIN_TTL),
      limit: Number(process.env.THROTTLE_AUTH_SIGNIN_LIMIT),
      blockDuration: Number(process.env.THROTTLE_AUTH_SIGNIN_BLOCKED_TTL),
    },
    signup: {
      ttl: Number(process.env.THROTTLE_AUTH_SIGNUP_TTL),
      limit: Number(process.env.THROTTLE_AUTH_SIGNUP_LIMIT),
      blockDuration: Number(process.env.THROTTLE_AUTH_SIGNUP_BLOCKED_TTL),
    },
  },
}));
