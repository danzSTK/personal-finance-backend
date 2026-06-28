import { Test } from '@nestjs/testing';
import { JobsModule } from './jobs.module';

describe('JobsModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: '5432',
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
      JWT_ACCESS_SECRET: '01234567890123456789012345678901',
      JWT_REFRESH_SECRET: '01234567890123456789012345678901',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
      GOOGLE_LINK_CALLBACK_URI: 'http://localhost:3000/auth/providers/link/google/callback',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'redis-password',
      REDIS_TTL: '3600',
      R2_ENDPOINT: 'https://example.com',
      R2_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BUCKET_NAME: 'public-bucket',
      R2_PRIVATE_BUCKET_NAME: 'private-bucket',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      CSRF_ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
      FRONTEND_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
      PORT: '3000',
      APP_URL: 'http://localhost:3000',
      BULLMQ_REDIS_DB: '1',
      BULLMQ_PREFIX: 'personal-finance-test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('module wiring', () => {
    it('compiles without registering concrete queues', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [JobsModule],
      }).compile();

      expect(moduleRef).toBeDefined();

      await moduleRef.close();
    });
  });
});
