import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import Joi from 'joi';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import googleOauthConfig from './google-oauth.config';
import redisConfig from './redis.config';
import throttleConfig from './throttle.config';
import appConfig from './app.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      cache: true,
      load: [databaseConfig, jwtConfig, googleOauthConfig, redisConfig, throttleConfig, appConfig],
      envFilePath: join(process.cwd(), '..', '.env'),
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
        APP_URL: Joi.string().uri().required(),

        // google oauth
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().uri().required(),
        GOOGLE_LINK_CALLBACK_URI: Joi.string().uri().required(),

        // frontend url
        FRONTEND_URL: Joi.string().uri().required(),

        // redis
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TTL: Joi.number().default(3600),

        // throttle
        THROTTLE_DEFAULT_TTL: Joi.number().default(60000),
        THROTTLE_DEFAULT_LIMIT: Joi.number().default(20),

        THROTTLE_AUTH_SIGNIN_TTL: Joi.number().optional(),
        THROTTLE_AUTH_SIGNIN_LIMIT: Joi.number().optional(),
        THROTTLE_AUTH_SIGNIN_BLOCKED_TTL: Joi.number().optional(),
        THROTTLE_AUTH_SIGNUP_TTL: Joi.number().optional(),
        THROTTLE_AUTH_SIGNUP_LIMIT: Joi.number().optional(),
        THROTTLE_AUTH_SIGNUP_BLOCKED_TTL: Joi.number().optional(),
      }),
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
  ],
})
export class ConfigModule {}
