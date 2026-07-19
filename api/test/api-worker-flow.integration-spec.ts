import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import type { INestApplicationContext } from '@nestjs/common';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { DataSource } from 'typeorm';
import type { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { ENTITIES } from '@/config/entities';
import { OutboxMessageStatus } from '@/common/models/enums';
import {
  BrevoTemplateId,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import {
  EmailJobIds,
  NotificationsQueues,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';
import workerConfig from '@/config/worker.config';
import type { ConfigType } from '@nestjs/config';

type CountRow = { count: string };
type StatusRow<TStatus extends string> = { status: TStatus };

describe('API and worker flow integration', () => {
  const postgresPassword = 'integration-postgres-password';
  const redisPassword = 'integration-redis-password';
  const originalEnv = process.env;

  let postgres: StartedPostgreSqlContainer;
  let cacheRedis: StartedRedisContainer;
  let bullmqRedis: StartedRedisContainer;
  let verificationDataSource: DataSource;
  let apiContext: INestApplicationContext;
  let workerContext: INestApplicationContext;
  let consoleLog: jest.SpyInstance;

  beforeAll(async () => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation();
    [postgres, cacheRedis, bullmqRedis] = await Promise.all([
      new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('danfy_integration')
        .withUsername('danfy')
        .withPassword(postgresPassword)
        .start(),
      new RedisContainer('redis:7-alpine').withPassword(redisPassword).start(),
      new RedisContainer('redis:7-alpine').withPassword(redisPassword).start(),
    ]);

    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PROCESS_ROLE: 'api',
      POSTGRES_HOST: postgres.getHost(),
      POSTGRES_PORT: String(postgres.getPort()),
      POSTGRES_USER: postgres.getUsername(),
      POSTGRES_PASSWORD: postgres.getPassword(),
      POSTGRES_DB: postgres.getDatabase(),
      REDIS_HOST: cacheRedis.getHost(),
      REDIS_PORT: String(cacheRedis.getPort()),
      REDIS_PASSWORD: redisPassword,
      REDIS_TTL: '60',
      BULLMQ_REDIS_HOST: bullmqRedis.getHost(),
      BULLMQ_REDIS_PORT: String(bullmqRedis.getPort()),
      BULLMQ_REDIS_PASSWORD: redisPassword,
      BULLMQ_REDIS_DB: '0',
      BULLMQ_PREFIX: `danfy-flow-${Date.now()}`,
      BULLMQ_DEFAULT_ATTEMPTS: '2',
      BULLMQ_BACKOFF_DELAY_MS: '100',
      BULLMQ_DEFAULT_CONCURRENCY: '2',
      OUTBOX_POLL_INTERVAL_MS: '100',
      OUTBOX_BATCH_SIZE: '10',
      OUTBOX_CONCURRENCY: '2',
      OUTBOX_LEASE_MS: '3000',
      OUTBOX_LEASE_RENEW_INTERVAL_MS: '1000',
      EMAIL_ENQUEUE_RECONCILE_INTERVAL_MS: '1000',
      EMAIL_ENQUEUE_RECONCILE_BATCH_SIZE: '10',
      EMAIL_ENQUEUE_STALE_AFTER_MS: '0',
      WORKER_SHUTDOWN_TIMEOUT_MS: '3000',
      WORKER_HEARTBEAT_INTERVAL_MS: '1000',
      WORKER_HEARTBEAT_TTL_MS: '3000',
      WORKER_INSTANCE_ID: 'flow-worker-1',
      JWT_ACCESS_SECRET: 'integration-access-secret-at-least-32-characters',
      JWT_REFRESH_SECRET: 'integration-refresh-secret-at-least-32-characters',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      GOOGLE_CLIENT_ID: 'integration-google-client',
      GOOGLE_CLIENT_SECRET: 'integration-google-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost/auth/google/callback',
      GOOGLE_LINK_CALLBACK_URI: 'http://localhost/auth/providers/link/google/callback',
      CSRF_ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
      FRONTEND_URL: 'http://localhost:5173',
      APP_URL: 'http://localhost:3000',
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
      MAIL_DEFAULT_FROM_NAME: 'Danfy Integration',
      SUPPORT_URL: 'https://integration.example.com/support',
      SUPPORT_URL_LABEL: 'Support',
    };
    delete process.env.BREVO_API_KEY;

    verificationDataSource = new DataSource({
      type: 'postgres',
      url: postgres.getConnectionUri(),
      entities: ENTITIES,
      migrations: [join(process.cwd(), 'src/database/migrations/*{.ts,.js}')],
      synchronize: false,
      logging: false,
    });
    await verificationDataSource.initialize();
    await verificationDataSource.runMigrations();

    const { NestFactory } = jest.requireActual<typeof import('@nestjs/core')>('@nestjs/core');
    const { ApiModule } = jest.requireActual<typeof import('@/app/api/api.module')>('@/app/api/api.module');
    apiContext = await NestFactory.createApplicationContext(ApiModule, { logger: false });

    process.env.PROCESS_ROLE = 'worker';
    const { WorkerModule } =
      jest.requireActual<typeof import('@/app/worker/worker.module')>('@/app/worker/worker.module');
    workerContext = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  });

  afterAll(async () => {
    await workerContext?.close();
    await apiContext?.close();
    if (verificationDataSource?.isInitialized) {
      await verificationDataSource.destroy();
    }
    await Promise.all([postgres?.stop(), cacheRedis?.stop(), bullmqRedis?.stop()]);
    consoleLog?.mockRestore();
    process.env = originalEnv;
  });

  it('keeps processors out of the API and loads them in a worker without an HTTP adapter', () => {
    const { OutboxProcessorService } = jest.requireActual<
      typeof import('@/shared/outbox/services/outbox-processor.service')
    >('@/shared/outbox/services/outbox-processor.service');
    const { EmailMessageProcessor } = jest.requireActual<
      typeof import('@/modules/notifications/infrastructure/queues/email-message.processor')
    >('@/modules/notifications/infrastructure/queues/email-message.processor');

    expect(() => apiContext.get(OutboxProcessorService, { strict: false })).toThrow();
    expect(() => apiContext.get(EmailMessageProcessor, { strict: false })).toThrow();
    expect(workerContext.get(OutboxProcessorService, { strict: false })).toBeInstanceOf(OutboxProcessorService);
    expect(workerContext.get(EmailMessageProcessor, { strict: false })).toBeInstanceOf(EmailMessageProcessor);
    expect('getHttpAdapter' in workerContext).toBe(false);
  });

  it('processes API -> outbox -> EventEmitter2 -> BullMQ -> noop email end to end', async () => {
    const { SignUpUseCase } = jest.requireActual<
      typeof import('@/modules/auth/application/use-cases/sign-up/sign-up.use-case')
    >('@/modules/auth/application/use-cases/sign-up/sign-up.use-case');
    const signUp = apiContext.get(SignUpUseCase, { strict: false });
    const suffix = Date.now();

    const result = await signUp.execute({
      email: `worker-flow-${suffix}@example.com`,
      password: 'A-valid-integration-password-123!',
      firstName: 'Worker',
      lastName: 'Flow',
      userName: `worker_flow_${suffix}`,
      sessionMetadata: {
        browser: 'Jest',
        os: 'Linux',
        device: 'Test runner',
        ip: '127.0.0.1',
        location: 'Integration',
        loginAt: new Date().toISOString(),
      },
    });

    await waitFor(async () => {
      const rows = await verificationDataSource.query<StatusRow<OutboxMessageStatus>[]>(
        `SELECT status FROM outbox_messages WHERE aggregate_id = $1`,
        [result.user.id],
      );
      return rows.length === 1 && rows[0].status === OutboxMessageStatus.PUBLISHED;
    });
    await waitFor(async () => {
      const rows = await verificationDataSource.query<StatusRow<EmailMessageStatus>[]>(
        `SELECT status FROM email_messages WHERE recipient_email = $1`,
        [result.user.email.value],
      );
      return rows.length === 1 && rows[0].status === EmailMessageStatus.SENT;
    });

    const [accounts] = await verificationDataSource.query<CountRow[]>(
      `SELECT count(*)::text AS count FROM accounts WHERE user_id = $1`,
      [result.user.id],
    );
    const [categories] = await verificationDataSource.query<CountRow[]>(
      `SELECT count(*)::text AS count FROM categories WHERE user_id = $1`,
      [result.user.id],
    );
    const [challenges] = await verificationDataSource.query<CountRow[]>(
      `SELECT count(*)::text AS count FROM email_verification_challenges WHERE user_id = $1`,
      [result.user.id],
    );

    expect(Number(accounts.count)).toBeGreaterThan(0);
    expect(Number(categories.count)).toBeGreaterThan(0);
    expect(challenges.count).toBe('1');
  });

  it('recovers persisted enqueue gaps with two concurrent reconcilers without duplicate jobs', async () => {
    const { EmailMessageEnqueueReconciler } = jest.requireActual<
      typeof import('@/modules/notifications/infrastructure/queues/email-message-enqueue-reconciler.service')
    >('@/modules/notifications/infrastructure/queues/email-message-enqueue-reconciler.service');
    const repository = workerContext.get(IEmailMessageRepository, { strict: false });
    const producer = workerContext.get(EmailJobQueueProducer, { strict: false });
    const config = workerContext.get<ConfigType<typeof workerConfig>>(workerConfig.KEY, { strict: false });
    const queue = workerContext.get<Queue<SendEmailMessageJobPayload>>(getQueueToken(NotificationsQueues.EMAIL), {
      strict: false,
    });
    const messageIds = [randomUUID(), randomUUID()];

    for (const [index, id] of messageIds.entries()) {
      await verificationDataSource.query(
        `
          INSERT INTO email_messages (
            id, type, recipient_email, recipient_name, provider, template_key,
            provider_template_id, template_params, idempotency_key, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - INTERVAL '1 minute', NOW())
        `,
        [
          id,
          EmailMessageType.EMAIL_VERIFICATION,
          `enqueue-gap-${index}@example.com`,
          'Integration',
          EmailProviderKey.BREVO,
          EmailTemplateKey.EMAIL_VERIFICATION,
          BrevoTemplateId.EMAIL_VERIFICATION,
          {
            verification_url: 'https://example.com/verify',
            expires_in_minutes: 15,
            support_url: 'https://example.com',
          },
          `integration:enqueue-gap:${id}`,
          EmailMessageStatus.PENDING,
        ],
      );
    }

    const reconcilerA = new EmailMessageEnqueueReconciler(repository, producer, config);
    const reconcilerB = new EmailMessageEnqueueReconciler(repository, producer, config);
    await Promise.all([reconcilerA.reconcile(), reconcilerB.reconcile()]);

    for (const id of messageIds) {
      await waitFor(async () => {
        const [row] = await verificationDataSource.query<StatusRow<EmailMessageStatus>[]>(
          `SELECT status FROM email_messages WHERE id = $1`,
          [id],
        );
        return row?.status === EmailMessageStatus.SENT;
      });
      await expect(queue.getJob(EmailJobIds.emailMessage(id))).resolves.not.toBeUndefined();
    }
    expect(messageIds.map(EmailJobIds.emailMessage)).toHaveLength(new Set(messageIds).size);
  });

  it('starts API and worker watch modes simultaneously in development', async () => {
    const apiWatch = spawn('npm', ['run', 'start:dev'], {
      cwd: process.cwd(),
      detached: true,
      env: { ...process.env, PROCESS_ROLE: 'api', PORT: '32189' },
    });
    const workerWatch = spawn('npm', ['run', 'start:worker:dev'], {
      cwd: process.cwd(),
      detached: true,
      env: { ...process.env, PROCESS_ROLE: 'worker', WORKER_INSTANCE_ID: 'watch-worker-2' },
    });

    try {
      await Promise.all([
        waitForProcessOutput(apiWatch, 'Nest application successfully started', 30_000),
        waitForProcessOutput(workerWatch, 'Worker started.', 30_000),
      ]);
    } finally {
      await Promise.all([stopProcessGroup(apiWatch), stopProcessGroup(workerWatch)]);
    }
  });
});

const waitFor = async (condition: () => Promise<boolean>, timeoutMs = 30_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Condition was not met within ${timeoutMs}ms.`);
};

const waitForProcessOutput = async (
  child: ChildProcessWithoutNullStreams,
  expectedText: string,
  timeoutMs: number,
): Promise<void> => {
  let output = '';

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Process did not emit "${expectedText}".\n${output}`)),
      timeoutMs,
    );
    timeout.unref();

    const collect = (chunk: Buffer): void => {
      output = `${output}${chunk.toString()}`.slice(-100_000);
      if (output.includes(expectedText)) {
        clearTimeout(timeout);
        resolve();
      }
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', code => {
      if (!output.includes(expectedText)) {
        clearTimeout(timeout);
        reject(new Error(`Process exited with code ${String(code)} before "${expectedText}".\n${output}`));
      }
    });
  });
};

const stopProcessGroup = async (child: ChildProcessWithoutNullStreams): Promise<void> => {
  if (child.exitCode !== null || !child.pid) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }

  await new Promise<void>(resolve => {
    const forceKill = setTimeout(() => {
      if (child.exitCode === null && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
      resolve();
    }, 5_000);
    forceKill.unref();
    child.once('exit', () => {
      clearTimeout(forceKill);
      resolve();
    });
  });
};
