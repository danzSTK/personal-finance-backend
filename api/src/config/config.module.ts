import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import Joi from 'joi';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import googleOauthConfig from './google-oauth.config';
import redisConfig from './redis.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      cache: true,
      load: [databaseConfig, jwtConfig, googleOauthConfig, redisConfig],
      envFilePath: join(process.cwd(), '..', '.env'),
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        POSTGRES_HOST: Joi.string().default('localhost'),
        POSTGRES_PORT: Joi.number().default(5432),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
        APP_URL: Joi.string().uri().default('http://localhost:3000'),

        // google oauth
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().uri().default('http://localhost:3000/auth/google/callback'),

        // frontend url
        FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),

        // redis
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().required(),
        REDIS_TTL: Joi.number().default(3600),
      }),
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
  ],
})
export class ConfigModule {}
