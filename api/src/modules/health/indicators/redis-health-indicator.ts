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
      const pong = await this.redisService.getClient().ping();
      const isHealthy = pong === 'PONG';

      return this.getStatus(key, isHealthy, {
        message: isHealthy ? 'Redis is healthy' : 'Redis is not healthy',
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      throw new HealthCheckError('Redis is not healthy', this.getStatus(key, false));
    }
  }
}
