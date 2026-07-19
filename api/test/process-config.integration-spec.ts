import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';

describe('Process bootstrap and secret contracts integration', () => {
  const apiRoot = process.cwd();
  const node = process.execPath;
  const configModulePath = join(apiRoot, 'dist/config/config.module.js');
  const nestCorePath = require.resolve('@nestjs/core');
  const workerEntrypoint = join(apiRoot, 'dist/worker.js');
  const apiEntrypoint = join(apiRoot, 'dist/main.js');

  const baseEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: '5432',
    POSTGRES_USER: 'danfy',
    POSTGRES_PASSWORD: 'secret',
    POSTGRES_DB: 'danfy_test',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'secret',
    BULLMQ_REDIS_HOST: '127.0.0.1',
    BULLMQ_REDIS_PORT: '6381',
    BULLMQ_PREFIX: 'danfy-process-test',
    FRONTEND_URL: 'http://localhost:5173',
    R2_ENDPOINT: 'https://integration.r2.example.com',
    R2_ACCOUNT_ID: 'integration-account',
    R2_ACCESS_KEY_ID: 'integration-access-key',
    R2_SECRET_ACCESS_KEY: 'integration-secret-key',
    R2_PUBLIC_BUCKET_NAME: 'integration-public',
    R2_PRIVATE_BUCKET_NAME: 'integration-private',
    R2_PUBLIC_BASE_URL: 'https://cdn.integration.example.com',
    MAIL_ENABLED: 'false',
    MAIL_PROVIDER: 'noop',
    MAIL_DEFAULT_FROM_EMAIL: 'no-reply@integration.example.com',
    SUPPORT_URL: 'https://integration.example.com/support',
  };

  const validateConfig = (env: NodeJS.ProcessEnv): SpawnSyncReturns<string> => {
    const script = `
      (async () => {
        try {
          const { NestFactory } = require(${JSON.stringify(nestCorePath)});
          const { ConfigModule } = require(${JSON.stringify(configModulePath)});
          const app = await NestFactory.createApplicationContext(ConfigModule, { logger: false });
          await app.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(message + '\\n');
          process.exitCode = 1;
        }
      })();
    `;

    return spawnSync(node, ['-e', script], {
      cwd: '/tmp',
      env,
      encoding: 'utf8',
      timeout: 10_000,
    });
  };

  it('validates API configuration without mail-provider secrets', () => {
    const result = validateConfig({
      ...baseEnv,
      PROCESS_ROLE: 'api',
      APP_URL: 'http://localhost:3000',
      CSRF_ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
      JWT_ACCESS_SECRET: 'integration-access-secret-at-least-32-characters',
      JWT_REFRESH_SECRET: 'integration-refresh-secret-at-least-32-characters',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      GOOGLE_CLIENT_ID: 'integration-google-client',
      GOOGLE_CLIENT_SECRET: 'integration-google-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost/auth/google/callback',
      GOOGLE_LINK_CALLBACK_URI: 'http://localhost/auth/providers/link/google/callback',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('validates worker configuration without HTTP authentication secrets', () => {
    const result = validateConfig({
      ...baseEnv,
      PROCESS_ROLE: 'worker',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('rejects both entrypoints when their configured role is mismatched', () => {
    const workerAsApi = spawnSync(node, [workerEntrypoint], {
      cwd: apiRoot,
      env: { ...baseEnv, PROCESS_ROLE: 'api' },
      encoding: 'utf8',
      timeout: 10_000,
    });
    const apiAsWorker = spawnSync(node, [apiEntrypoint], {
      cwd: apiRoot,
      env: { ...baseEnv, PROCESS_ROLE: 'worker' },
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(workerAsApi.status).toBe(1);
    expect(apiAsWorker.status).toBe(1);
  });

  it('rejects missing mandatory process configuration before startup', () => {
    const invalidEnv = { ...baseEnv };
    delete invalidEnv.POSTGRES_HOST;
    const result = validateConfig({ ...invalidEnv, PROCESS_ROLE: 'worker' });

    expect(result.status).toBe(1);
  });
});
