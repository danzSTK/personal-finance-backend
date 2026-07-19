import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { ConfigType } from '@nestjs/config';
import queueConfig from '@/config/queue.config';
import workerConfig from '@/config/worker.config';
import { WorkerHeartbeatService } from '@/app/worker/operations/worker-heartbeat.service';
import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { BullmqEmailJobQueueProducer } from '@/modules/notifications/infrastructure/queues/bullmq-email-job-queue-producer';
import {
  EmailJobNames,
  NotificationsQueues,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';

describe('BullMQ and Redis integration', () => {
  const password = 'integration-redis-password';
  const prefix = `danfy-integration-${Date.now()}`;
  const originalWorkerInstanceId = process.env.WORKER_INSTANCE_ID;

  let container: StartedRedisContainer;
  let queue: Queue<SendEmailMessageJobPayload>;
  let queueEvents: QueueEvents;
  let redis: Redis;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').withPassword(password).start();
    const connection = {
      host: container.getHost(),
      port: container.getPort(),
      password,
      maxRetriesPerRequest: null,
    };
    queue = new Queue<SendEmailMessageJobPayload>(NotificationsQueues.EMAIL, {
      connection,
      prefix,
    });
    queue.setMaxListeners(20);
    queueEvents = new QueueEvents(NotificationsQueues.EMAIL, { connection, prefix });
    redis = new Redis({
      host: container.getHost(),
      port: container.getPort(),
      password,
      maxRetriesPerRequest: 1,
    });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await queueEvents?.close();
    await queue?.close();
    if (redis?.status === 'ready') {
      await redis.quit();
    } else {
      redis?.disconnect();
    }
    await container?.stop();
    if (originalWorkerInstanceId === undefined) {
      delete process.env.WORKER_INSTANCE_ID;
    } else {
      process.env.WORKER_INSTANCE_ID = originalWorkerInstanceId;
    }
  });

  beforeEach(async () => {
    await queue.obliterate({ force: true });
  });

  it('deduplicates concurrent enqueue attempts by deterministic job id', async () => {
    const producer = new BullmqEmailJobQueueProducer(queue);

    await Promise.all([
      producer.enqueueEmailMessage('email-message-1'),
      producer.enqueueEmailMessage('email-message-1'),
    ]);

    const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'email-message-email-message-1',
      name: EmailJobNames.SEND_EMAIL_MESSAGE,
      data: { emailMessageId: 'email-message-1' },
    });
  });

  it('processes every job once with two concurrent worker instances', async () => {
    const processedIds: string[] = [];
    const connection = {
      host: container.getHost(),
      port: container.getPort(),
      password,
      maxRetriesPerRequest: null,
    };
    const processor = async (job: { id?: string }): Promise<void> => {
      if (job.id) {
        processedIds.push(job.id);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    };
    const workerA = new Worker(NotificationsQueues.EMAIL, processor, { connection, prefix, concurrency: 2 });
    const workerB = new Worker(NotificationsQueues.EMAIL, processor, { connection, prefix, concurrency: 2 });

    try {
      await Promise.all([workerA.waitUntilReady(), workerB.waitUntilReady()]);
      const jobs = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          queue.add(
            EmailJobNames.SEND_EMAIL_MESSAGE,
            { emailMessageId: `email-${index}` },
            { jobId: `integration-email-${index}` },
          ),
        ),
      );

      await Promise.all(jobs.map(job => job.waitUntilFinished(queueEvents, 20_000)));

      expect(processedIds).toHaveLength(12);
      expect(new Set(processedIds).size).toBe(12);
      await expect(queue.getJobCounts('failed')).resolves.toMatchObject({ failed: 0 });
    } finally {
      await Promise.all([workerA.close(), workerB.close()]);
    }
  });

  it('writes a namespaced heartbeat with a real Redis TTL and removes it on shutdown', async () => {
    process.env.WORKER_INSTANCE_ID = 'integration-worker-1';
    const queueSettings = {
      redis: {
        host: container.getHost(),
        port: container.getPort(),
        password,
        db: 0,
      },
      prefix,
    } as ConfigType<typeof queueConfig>;
    const workerSettings = {
      heartbeat: { intervalMs: 1_000, ttlMs: 3_000 },
    } as ConfigType<typeof workerConfig>;
    const operationalRedis = new BullmqOperationalRedisService(queueSettings);
    const heartbeat = new WorkerHeartbeatService(operationalRedis, queueSettings, workerSettings);
    const key = `${prefix}:worker:heartbeat:integration-worker-1`;

    try {
      heartbeat.onModuleInit();
      await waitFor(async () => (await redis.exists(key)) === 1);

      const ttl = await redis.pttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3_000);

      await heartbeat.beforeApplicationShutdown();
      await expect(redis.exists(key)).resolves.toBe(0);
    } finally {
      await operationalRedis.onApplicationShutdown();
    }
  });

  it('expires the heartbeat when an instance stops renewing it without graceful shutdown', async () => {
    process.env.WORKER_INSTANCE_ID = 'crashed-integration-worker';
    const queueSettings = {
      redis: {
        host: container.getHost(),
        port: container.getPort(),
        password,
        db: 0,
      },
      prefix,
    } as ConfigType<typeof queueConfig>;
    const workerSettings = {
      heartbeat: { intervalMs: 50, ttlMs: 150 },
    } as ConfigType<typeof workerConfig>;
    const operationalRedis = new BullmqOperationalRedisService(queueSettings);
    const heartbeat = new WorkerHeartbeatService(operationalRedis, queueSettings, workerSettings);
    const heartbeatState = heartbeat as unknown as { interval: NodeJS.Timeout | null };
    const key = `${prefix}:worker:heartbeat:crashed-integration-worker`;

    try {
      heartbeat.onModuleInit();
      await waitFor(async () => (await redis.exists(key)) === 1);
      if (heartbeatState.interval) {
        clearInterval(heartbeatState.interval);
        heartbeatState.interval = null;
      }

      await waitFor(async () => (await redis.exists(key)) === 0, 2_000);
    } finally {
      await heartbeat.beforeApplicationShutdown();
      await operationalRedis.onApplicationShutdown();
    }
  });
});

const waitFor = async (condition: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Condition was not met within ${timeoutMs}ms.`);
};
