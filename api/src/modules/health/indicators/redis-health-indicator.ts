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
    } catch (error) {
      throw new HealthCheckError(
        'Redis is not healthy',
        this.getStatus(key, false, {
          message: 'Redis is not healthy',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
