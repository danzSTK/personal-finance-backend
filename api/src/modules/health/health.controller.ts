import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis-health-indicator';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get('liveness')
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get('readiness')
  @HealthCheck()
  @SkipThrottle({ default: true })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 300 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
