import queueConfig from '@/config/queue.config';
import { RedisService } from '@/database/redis/redis.service';
import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getWorkerHeartbeatKey } from '@/app/worker/operations/worker-instance';

@Injectable()
export class WorkerHealthService {
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
    await this.dataSource.query('SELECT 1');
    await this.cacheRedis.getClient().ping();
    await this.bullmqRedis.ping();

    const heartbeat = await this.bullmqRedis.get(this.heartbeatKey);
    if (!heartbeat) {
      throw new Error(`Worker heartbeat is missing for ${this.heartbeatKey}.`);
    }
  }
}
