import type { RedisService } from '@/database/redis/redis.service';
import type { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import type { DataSource } from 'typeorm';
import { WorkerHealthService } from './worker-health.service';

describe('WorkerHealthService', () => {
  const queueConfig = {
    prefix: 'finance-test',
    redis: { host: 'queue-redis', port: 6379, db: 0 },
    defaultJobOptions: {
      attempts: 5,
      backoffType: 'exponential' as const,
      backoffDelayMs: 5_000,
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
    workers: { defaultConcurrency: 5 },
  };

  let dataSource: jest.Mocked<DataSource>;
  let cacheRedis: jest.Mocked<RedisService>;
  let bullmqRedis: jest.Mocked<BullmqOperationalRedisService>;
  let query: jest.Mock;
  let bullmqPing: jest.Mock;
  let heartbeatGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    bullmqPing = jest.fn().mockResolvedValue('PONG');
    heartbeatGet = jest.fn().mockResolvedValue(new Date().toISOString());
    dataSource = { query } as unknown as jest.Mocked<DataSource>;
    cacheRedis = {
      getClient: jest.fn().mockReturnValue({ ping: jest.fn().mockResolvedValue('PONG') }),
    } as unknown as jest.Mocked<RedisService>;
    bullmqRedis = {
      ping: bullmqPing,
      get: heartbeatGet,
    } as unknown as jest.Mocked<BullmqOperationalRedisService>;
  });

  it('passes when PostgreSQL, both Redis instances and heartbeat are available', async () => {
    const service = new WorkerHealthService(dataSource, cacheRedis, bullmqRedis, queueConfig);

    await expect(service.check()).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(bullmqPing).toHaveBeenCalledTimes(1);
  });

  it('fails when the worker heartbeat is absent', async () => {
    heartbeatGet.mockResolvedValue(null);
    const service = new WorkerHealthService(dataSource, cacheRedis, bullmqRedis, queueConfig);

    await expect(service.check()).rejects.toThrow('Worker heartbeat is missing');
  });

  it('fails when a required dependency is unavailable', async () => {
    query.mockRejectedValue(new Error('postgres unavailable'));
    const service = new WorkerHealthService(dataSource, cacheRedis, bullmqRedis, queueConfig);

    await expect(service.check()).rejects.toThrow('postgres unavailable');
  });
});
