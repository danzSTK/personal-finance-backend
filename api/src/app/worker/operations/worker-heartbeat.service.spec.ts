import queueConfig from '@/config/queue.config';
import workerConfig from '@/config/worker.config';
import type { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

describe('WorkerHeartbeatService', () => {
  const originalWorkerInstanceId = process.env.WORKER_INSTANCE_ID;
  const queue = { prefix: 'danfy-test' } as ConfigType<typeof queueConfig>;
  const config = {
    heartbeat: { intervalMs: 1_000, ttlMs: 3_000 },
  } as ConfigType<typeof workerConfig>;

  let setWithTtl: jest.Mock;
  let deleteHeartbeat: jest.Mock;
  let redis: jest.Mocked<BullmqOperationalRedisService>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env.WORKER_INSTANCE_ID = 'worker-1';
    setWithTtl = jest.fn().mockResolvedValue(undefined);
    deleteHeartbeat = jest.fn().mockResolvedValue(undefined);
    redis = {
      setWithTtl,
      delete: deleteHeartbeat,
    } as unknown as jest.Mocked<BullmqOperationalRedisService>;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalWorkerInstanceId === undefined) {
      delete process.env.WORKER_INSTANCE_ID;
    } else {
      process.env.WORKER_INSTANCE_ID = originalWorkerInstanceId;
    }
  });

  it('writes immediately and renews the heartbeat with the configured TTL', async () => {
    const service = new WorkerHeartbeatService(redis, queue, config);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);

    expect(setWithTtl).toHaveBeenCalledWith('danfy-test:worker:heartbeat:worker-1', expect.any(String), 3_000);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(setWithTtl).toHaveBeenCalledTimes(2);
    await service.beforeApplicationShutdown();
  });

  it('stops renewing and removes the heartbeat during shutdown', async () => {
    const service = new WorkerHeartbeatService(redis, queue, config);
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);

    await service.beforeApplicationShutdown();
    await jest.advanceTimersByTimeAsync(2_000);

    expect(deleteHeartbeat).toHaveBeenCalledWith('danfy-test:worker:heartbeat:worker-1');
    expect(setWithTtl).toHaveBeenCalledTimes(1);
  });

  it('keeps the worker alive when Redis temporarily rejects a heartbeat', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    setWithTtl.mockRejectedValueOnce(new Error('redis unavailable'));
    const service = new WorkerHeartbeatService(redis, queue, config);

    expect(() => service.onModuleInit()).not.toThrow();
    await jest.advanceTimersByTimeAsync(0);

    expect(error).toHaveBeenCalledWith(
      'Failed to write worker heartbeat. key=danfy-test:worker:heartbeat:worker-1',
      expect.stringContaining('redis unavailable'),
    );
    await service.beforeApplicationShutdown();
  });
});
