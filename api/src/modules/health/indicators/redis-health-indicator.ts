import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../database/redis/redis.service';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redisService.set('__health__', '1', 5);
      const val = await this.redisService.get('__health__');
      const isHealthy = val === '1';

      return this.getStatus(key, isHealthy, {
        value: val,
        message: isHealthy ? 'Redis is healthy' : 'Redis is not healthy',
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      throw new HealthCheckError('Redis is not healthy', this.getStatus(key, false));
    }
  }
}
