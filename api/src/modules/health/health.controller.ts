import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis-health-indicator';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
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
  @SkipThrottle({ default: true })
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Valida se a aplicação está viva (sem checar dependências externas).',
  })
  @ApiResponse({
    status: 200,
    description: 'Aplicação viva',
  })
  liveness() {
    return this.health.check([]);
  }

  @Get('readiness')
  @HealthCheck()
  @SkipThrottle({ default: true })
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Valida dependências críticas (Postgres, memória e Redis).',
  })
  @ApiResponse({
    status: 200,
    description: 'Aplicação pronta para receber tráfego',
  })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 300 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
