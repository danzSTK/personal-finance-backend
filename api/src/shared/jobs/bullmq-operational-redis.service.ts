import queueConfig from '@/config/queue.config';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class BullmqOperationalRedisService implements OnApplicationShutdown {
  private readonly client: Redis;

  constructor(
    @Inject(queueConfig.KEY)
    config: ConfigType<typeof queueConfig>,
  ) {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async ping(): Promise<string> {
    await this.connectIfNeeded();
    return await this.client.ping();
  }

  async setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    await this.connectIfNeeded();
    await this.client.set(key, value, 'PX', ttlMs);
  }

  async get(key: string): Promise<string | null> {
    await this.connectIfNeeded();
    return await this.client.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.connectIfNeeded();
    await this.client.del(key);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }

    if (this.client.status !== 'end' && this.client.status !== 'wait') {
      this.client.disconnect();
    }
  }

  private async connectIfNeeded(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }
}
