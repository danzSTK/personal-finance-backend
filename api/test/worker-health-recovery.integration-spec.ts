import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { StartedToxiProxyContainer, ToxiProxyContainer } from '@testcontainers/toxiproxy';
import { Network, StartedNetwork } from 'testcontainers';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import queueConfig from '@/config/queue.config';
import { RedisService } from '@/database/redis/redis.service';
import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { WorkerHealthService } from '@/app/worker/health/worker-health.service';

describe('Worker health dependency recovery integration', () => {
  const postgresPassword = 'integration-postgres-password';
  const redisPassword = 'integration-redis-password';
  const originalWorkerInstanceId = process.env.WORKER_INSTANCE_ID;

  let network: StartedNetwork;
  let postgres: StartedPostgreSqlContainer;
  let cacheRedisContainer: StartedRedisContainer;
  let bullmqRedisContainer: StartedRedisContainer;
  let toxiproxy: StartedToxiProxyContainer;
  let postgresProxy: TestProxy;
  let cacheRedisProxy: TestProxy;
  let bullmqRedisProxy: TestProxy;
  let dataSource: DataSource;
  let cacheClient: Redis;
  let cacheRedis: RedisService;
  let bullmqRedis: BullmqOperationalRedisService;
  let health: WorkerHealthService;
  let consoleError: jest.SpyInstance;

  beforeAll(async () => {
    consoleError = jest.spyOn(console, 'error').mockImplementation();
    network = await new Network().start();
    [postgres, cacheRedisContainer, bullmqRedisContainer, toxiproxy] = await Promise.all([
      new PostgreSqlContainer('postgres:16-alpine')
        .withPassword(postgresPassword)
        .withNetwork(network)
        .withNetworkAliases('postgres')
        .start(),
      new RedisContainer('redis:7-alpine')
        .withPassword(redisPassword)
        .withNetwork(network)
        .withNetworkAliases('cache-redis')
        .start(),
      new RedisContainer('redis:7-alpine')
        .withPassword(redisPassword)
        .withNetwork(network)
        .withNetworkAliases('bullmq-redis')
        .start(),
      new ToxiProxyContainer('ghcr.io/shopify/toxiproxy:2.12.0').withNetwork(network).start(),
    ]);

    [postgresProxy, cacheRedisProxy, bullmqRedisProxy] = await Promise.all([
      createProxy(toxiproxy, 'postgres-proxy', 'postgres:5432', 8666),
      createProxy(toxiproxy, 'cache-redis-proxy', 'cache-redis:6379', 8667),
      createProxy(toxiproxy, 'bullmq-redis-proxy', 'bullmq-redis:6379', 8668),
    ]);

    dataSource = new DataSource({
      type: 'postgres',
      host: postgresProxy.host,
      port: postgresProxy.port,
      username: postgres.getUsername(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
      extra: { connectionTimeoutMillis: 1_000 },
      logging: false,
    });
    await dataSource.initialize();

    cacheClient = new Redis({
      host: cacheRedisProxy.host,
      port: cacheRedisProxy.port,
      password: redisPassword,
      maxRetriesPerRequest: 1,
      retryStrategy: () => 50,
    });
    cacheClient.on('error', () => undefined);
    cacheRedis = new RedisService(cacheClient);

    process.env.WORKER_INSTANCE_ID = 'health-integration-worker';
    const queueSettings = {
      redis: {
        host: bullmqRedisProxy.host,
        port: bullmqRedisProxy.port,
        password: redisPassword,
        db: 0,
      },
      prefix: 'danfy-health-integration',
    } as ConfigType<typeof queueConfig>;
    bullmqRedis = new BullmqOperationalRedisService(queueSettings);
    health = new WorkerHealthService(dataSource, cacheRedis, bullmqRedis, queueSettings);
    await bullmqRedis.setWithTtl(
      'danfy-health-integration:worker:heartbeat:health-integration-worker',
      new Date().toISOString(),
      60_000,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await cacheRedis?.onApplicationShutdown();
    await bullmqRedis?.onApplicationShutdown();
    await Promise.all([toxiproxy?.stop(), postgres?.stop(), cacheRedisContainer?.stop(), bullmqRedisContainer?.stop()]);
    await network?.stop();
    consoleError?.mockRestore();
    if (originalWorkerInstanceId === undefined) {
      delete process.env.WORKER_INSTANCE_ID;
    } else {
      process.env.WORKER_INSTANCE_ID = originalWorkerInstanceId;
    }
  });

  it('becomes unhealthy and recovers when PostgreSQL connectivity returns', async () => {
    await expect(health.check()).resolves.toBeUndefined();

    const outage = await addConnectionReset(postgresProxy, 'postgres-outage');
    try {
      await expect(health.check()).rejects.toThrow();
    } finally {
      await outage.remove();
    }
    await waitForHealthy(health);
  });

  it('becomes unhealthy and recovers when cache Redis connectivity returns', async () => {
    await expect(health.check()).resolves.toBeUndefined();

    const outage = await addConnectionReset(cacheRedisProxy, 'cache-redis-outage');
    try {
      await expect(health.check()).rejects.toThrow();
    } finally {
      await outage.remove();
    }
    await waitForHealthy(health);
  });

  it('becomes unhealthy and recovers when BullMQ Redis connectivity returns', async () => {
    await expect(health.check()).resolves.toBeUndefined();

    const outage = await addConnectionReset(bullmqRedisProxy, 'bullmq-redis-outage');
    try {
      await expect(health.check()).rejects.toThrow();
    } finally {
      await outage.remove();
    }
    await waitForHealthy(health);
  });
});

type TestProxy = {
  host: string;
  port: number;
  path: string;
};

const createProxy = async (
  toxiproxy: StartedToxiProxyContainer,
  name: string,
  upstream: string,
  listenPort: number,
): Promise<TestProxy> => {
  const response = await fetch(`${toxiproxy.client.host}/proxies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, listen: `0.0.0.0:${listenPort}`, upstream, enabled: true }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Toxiproxy could not create ${name}: ${response.status} ${body}`);
  }

  return {
    host: toxiproxy.getHost(),
    port: toxiproxy.getMappedPort(listenPort),
    path: `${toxiproxy.client.host}/proxies/${name}`,
  };
};

const addConnectionReset = async (proxy: TestProxy, name: string) => {
  const path = `${proxy.path}/toxics`;
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attributes: { timeout: 100 },
      name,
      stream: 'upstream',
      toxicity: 1,
      type: 'timeout',
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Toxiproxy rejected ${name}: ${response.status} ${body}`);
  }

  return {
    remove: async (): Promise<void> => {
      const removeResponse = await fetch(`${path}/${name}`, { method: 'DELETE' });
      if (!removeResponse.ok) {
        throw new Error(`Toxiproxy could not remove ${name}: ${removeResponse.status}`);
      }
    },
  };
};

const waitForHealthy = async (health: WorkerHealthService, timeoutMs = 10_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await health.check();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Worker health did not recover within ${timeoutMs}ms.`);
};
