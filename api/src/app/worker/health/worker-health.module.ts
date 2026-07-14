import { ConfigModule } from '@/config/config.module';
import { PostgresModule } from '@/database/postgres/postgres.module';
import { RedisModule } from '@/database/redis/redis.module';
import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { Module } from '@nestjs/common';
import { WorkerHealthService } from '@/app/worker/health/worker-health.service';

@Module({
  imports: [ConfigModule, PostgresModule, RedisModule],
  providers: [BullmqOperationalRedisService, WorkerHealthService],
  exports: [WorkerHealthService],
})
export class WorkerHealthModule {}
