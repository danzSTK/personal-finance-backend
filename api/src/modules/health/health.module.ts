import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis-health-indicator';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
