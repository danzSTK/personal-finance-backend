import queueConfig from '@/config/queue.config';
import workerConfig from '@/config/worker.config';
import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { getWorkerHeartbeatKey } from '@/app/worker/operations/worker-instance';

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  private readonly heartbeatKey: string;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: BullmqOperationalRedisService,
    @Inject(queueConfig.KEY) queue: ConfigType<typeof queueConfig>,
    @Inject(workerConfig.KEY)
    private readonly config: ConfigType<typeof workerConfig>,
  ) {
    this.heartbeatKey = getWorkerHeartbeatKey(queue);
  }

  onModuleInit(): void {
    void this.writeHeartbeat();
    this.interval = setInterval(() => void this.writeHeartbeat(), this.config.heartbeat.intervalMs);
    this.interval.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    try {
      await this.redis.delete(this.heartbeatKey);
    } catch {
      this.logger.warn(`Failed to remove worker heartbeat. key=${this.heartbeatKey}`);
    }
  }

  private async writeHeartbeat(): Promise<void> {
    try {
      await this.redis.setWithTtl(this.heartbeatKey, new Date().toISOString(), this.config.heartbeat.ttlMs);
    } catch (error) {
      this.logger.error(
        `Failed to write worker heartbeat. key=${this.heartbeatKey}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
