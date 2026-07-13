import objectStorageConfig from '@/config/object-storage.config';
import mailConfig from '@/config/mail.config';
import notificationsConfig from '@/config/notifications.config';
import queueConfig from '@/config/queue.config';
import workerConfig from '@/config/worker.config';
import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { join } from 'path';
import appConfig from './app.config';
import databaseConfig from './database.config';
import googleOauthConfig from './google-oauth.config';
import jwtConfig from './jwt.config';
import redisConfig from './redis.config';
import throttleConfig from './throttle.config';

export const getWorkerConfigInvariantError = (value: Record<string, unknown>): string | null => {
  if (Number(value.OUTBOX_LEASE_RENEW_INTERVAL_MS) >= Number(value.OUTBOX_LEASE_MS)) {
    return 'OUTBOX_LEASE_RENEW_INTERVAL_MS must be lower than OUTBOX_LEASE_MS';
  }

  if (Number(value.OUTBOX_CONCURRENCY) > Number(value.OUTBOX_BATCH_SIZE)) {
    return 'OUTBOX_CONCURRENCY must not exceed OUTBOX_BATCH_SIZE';
  }

  if (Number(value.WORKER_HEARTBEAT_INTERVAL_MS) >= Number(value.WORKER_HEARTBEAT_TTL_MS)) {
    return 'WORKER_HEARTBEAT_INTERVAL_MS must be lower than WORKER_HEARTBEAT_TTL_MS';
  }

  return null;
};

@Module({
  imports: [
    NestConfigModule.forRoot({
      cache: true,
      load: [
        databaseConfig,
        jwtConfig,
        googleOauthConfig,
        redisConfig,
        throttleConfig,
        appConfig,
        objectStorageConfig,
        mailConfig,
        notificationsConfig,
        queueConfig,
        workerConfig,
      ],
      envFilePath: join(process.cwd(), '..', '.env'),
      isGlobal: true,
      validationSchema: Joi.object({
        PROCESS_ROLE: Joi.string().valid(ProcessRoles.API, ProcessRoles.WORKER).default(ProcessRoles.API),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        JWT_ACCESS_SECRET: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().min(32).required(),
          otherwise: Joi.string().optional(),
        }),
        JWT_REFRESH_SECRET: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().min(32).required(),
          otherwise: Joi.string().optional(),
        }),
        JWT_ACCESS_EXPIRES_IN: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        JWT_REFRESH_EXPIRES_IN: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),

        // google oauth
        GOOGLE_CLIENT_ID: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        GOOGLE_CLIENT_SECRET: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        GOOGLE_CALLBACK_URL: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().uri().required(),
          otherwise: Joi.string().uri().optional(),
        }),
        GOOGLE_LINK_CALLBACK_URI: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().uri().required(),
          otherwise: Joi.string().uri().optional(),
        }),

        // redis
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TTL: Joi.number().default(3600),

        // mail
        MAIL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
        MAIL_PROVIDER: Joi.string().valid('brevo', 'noop').default('noop'),
        MAIL_DEFAULT_FROM_EMAIL: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.WORKER,
          then: Joi.when('MAIL_ENABLED', {
            is: true,
            then: Joi.string().email().required(),
            otherwise: Joi.string().email().optional(),
          }),
          otherwise: Joi.string().email().optional(),
        }),
        MAIL_DEFAULT_FROM_NAME: Joi.string().trim().optional(),
        BREVO_API_KEY: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.WORKER,
          then: Joi.when('MAIL_ENABLED', {
            is: true,
            then: Joi.when('MAIL_PROVIDER', {
              is: 'brevo',
              then: Joi.string().required().invalid(''),
              otherwise: Joi.string().allow('').optional(),
            }),
            otherwise: Joi.string().allow('').optional(),
          }),
          otherwise: Joi.string().allow('').optional(),
        }),
        BREVO_API_BASE_URL: Joi.string().uri().default('https://api.brevo.com/v3'),
        BREVO_API_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
        BREVO_API_MAX_RETRIES: Joi.number().integer().min(0).default(2),

        // notifications
        NOTIFICATIONS_DASHBOARD_PATH: Joi.string().trim().pattern(/^\//).default('/dashboard'),
        NOTIFICATIONS_EMAIL_PREFERENCES_PATH: Joi.string().trim().pattern(/^\//).default('/settings/email-preferences'),
        NOTIFICATIONS_EMAIL_VERIFICATION_PATH: Joi.string().trim().pattern(/^\//).default('/verification-email'),
        NOTIFICATIONS_EMAIL_VERIFICATION_PROVIDER_TEMPLATE_ID: Joi.string().trim().min(1).default('3'),
        EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(15),
        EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES: Joi.number().integer().min(1).default(60),
        EMAIL_VERIFICATION_DAILY_LIMIT: Joi.number().integer().min(1).default(5),
        SUPPORT_URL: Joi.when('MAIL_ENABLED', {
          is: true,
          then: Joi.string().uri().required(),
          otherwise: Joi.string().uri().default('http://localhost:5173/support'),
        }),
        SUPPORT_URL_LABEL: Joi.string().trim().min(1).default('Central de ajuda'),

        // bullmq
        BULLMQ_REDIS_HOST: Joi.string().optional(),
        BULLMQ_REDIS_PORT: Joi.number().port().optional(),
        BULLMQ_REDIS_PASSWORD: Joi.string().allow('').optional(),
        BULLMQ_REDIS_DB: Joi.number().integer().min(0).default(1),
        BULLMQ_PREFIX: Joi.string().trim().min(1).default('personal-finance'),
        BULLMQ_DEFAULT_ATTEMPTS: Joi.number().integer().min(1).default(5),
        BULLMQ_BACKOFF_TYPE: Joi.string().valid('fixed', 'exponential').default('exponential'),
        BULLMQ_BACKOFF_DELAY_MS: Joi.number().integer().min(1).default(5000),
        BULLMQ_REMOVE_ON_COMPLETE: Joi.number().integer().min(0).default(1000),
        BULLMQ_REMOVE_ON_FAIL: Joi.number().integer().min(0).default(5000),
        BULLMQ_DEFAULT_CONCURRENCY: Joi.number().integer().min(1).default(5),

        OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(1000),
        OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).default(25),
        OUTBOX_CONCURRENCY: Joi.number().integer().min(1).default(5),
        OUTBOX_LEASE_MS: Joi.number().integer().min(1000).default(30000),
        OUTBOX_LEASE_RENEW_INTERVAL_MS: Joi.number().integer().min(100).default(10000),
        WORKER_SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
        EMAIL_ENQUEUE_RECONCILE_INTERVAL_MS: Joi.number().integer().min(1000).default(30000),
        EMAIL_ENQUEUE_RECONCILE_BATCH_SIZE: Joi.number().integer().min(1).default(100),
        EMAIL_ENQUEUE_STALE_AFTER_MS: Joi.number().integer().min(0).default(30000),
        WORKER_HEARTBEAT_INTERVAL_MS: Joi.number().integer().min(1000).default(10000),
        WORKER_HEARTBEAT_TTL_MS: Joi.number().integer().min(2000).default(30000),

        // throttle
        THROTTLE_DEFAULT_TTL: Joi.number().default(60000),
        THROTTLE_DEFAULT_LIMIT: Joi.number().default(20),

        THROTTLE_AUTH_SIGNIN_TTL: Joi.number().optional(),
        THROTTLE_AUTH_SIGNIN_LIMIT: Joi.number().optional(),
        THROTTLE_AUTH_SIGNIN_BLOCKED_TTL: Joi.number().optional(),
        THROTTLE_AUTH_SIGNUP_TTL: Joi.number().optional(),
        THROTTLE_AUTH_SIGNUP_LIMIT: Joi.number().optional(),
        THROTTLE_AUTH_SIGNUP_BLOCKED_TTL: Joi.number().optional(),

        // storage r2
        R2_ENDPOINT: Joi.string().required(),
        R2_ACCOUNT_ID: Joi.string().required(),
        R2_ACCESS_KEY_ID: Joi.string().required(),
        R2_SECRET_ACCESS_KEY: Joi.string().required(),
        R2_PUBLIC_BUCKET_NAME: Joi.string().required(),
        R2_PRIVATE_BUCKET_NAME: Joi.string().required(),
        R2_PUBLIC_BASE_URL: Joi.string().uri().required(),

        // app
        CSRF_ALLOWED_ORIGINS: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string()
            .trim()
            .min(1)
            .required()
            .custom((value: string, helpers) => {
              const origins = value
                .split(',')
                .map(origin => origin.trim())
                .filter(Boolean);

              if (origins.length === 0) {
                return helpers.error('any.invalid');
              }

              for (const origin of origins) {
                try {
                  const parsed = new URL(origin);

                  if (parsed.origin !== origin) {
                    return helpers.error('string.uri');
                  }
                } catch {
                  return helpers.error('string.uri');
                }
              }

              return value;
            }, 'CSRF allowed origins validation')
            .messages({
              'any.invalid': 'CSRF_ALLOWED_ORIGINS must contain at least one valid origin',
              'string.uri': 'CSRF_ALLOWED_ORIGINS must be a comma-separated list of valid origins',
            }),
          otherwise: Joi.string().optional(),
        }),
        FRONTEND_URL: Joi.string().uri().required(),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        APP_URL: Joi.when('PROCESS_ROLE', {
          is: ProcessRoles.API,
          then: Joi.string().uri().required(),
          otherwise: Joi.string().uri().optional(),
        }),
      }).custom((value: Record<string, unknown>, helpers) => {
        const invariantError = getWorkerConfigInvariantError(value);
        if (invariantError) {
          return helpers.message({ custom: invariantError });
        }

        return value;
      }),
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
  ],
})
export class ConfigModule {}
