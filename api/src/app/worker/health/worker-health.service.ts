import queueConfig from '@/config/queue.config';
import { RedisService } from '@/database/redis/redis.service';
import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getWorkerHeartbeatKey } from '@/app/worker/operations/worker-instance';

@Injectable()
export class WorkerHealthService {
  private static readonly dependencyTimeoutMs = 2_000;
  private readonly heartbeatKey: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheRedis: RedisService,
    private readonly bullmqRedis: BullmqOperationalRedisService,
    @Inject(queueConfig.KEY) queue: ConfigType<typeof queueConfig>,
  ) {
    this.heartbeatKey = getWorkerHeartbeatKey(queue);
  }

  async check(): Promise<void> {
    await Promise.all([
      this.withTimeout('PostgreSQL', this.dataSource.query('SELECT 1')),
      this.withTimeout('cache Redis', this.cacheRedis.getClient().ping()),
      this.withTimeout('BullMQ Redis', this.checkBullmqRedisAndHeartbeat()),
    ]);
  }

  private async checkBullmqRedisAndHeartbeat(): Promise<void> {
    await this.bullmqRedis.ping();
    const heartbeat = await this.bullmqRedis.get(this.heartbeatKey);
    if (!heartbeat) {
      throw new Error(`Worker heartbeat is missing for ${this.heartbeatKey}.`);
    }
  }

  private async withTimeout<T>(dependency: string, operation: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(`${dependency} health check timed out after ${WorkerHealthService.dependencyTimeoutMs}ms.`));
      }, WorkerHealthService.dependencyTimeoutMs);
      timeout.unref();
    });

    try {
      return await Promise.race([operation, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
