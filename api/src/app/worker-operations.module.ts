import { BullmqOperationalRedisService } from '@/shared/jobs/bullmq-operational-redis.service';
import { Module } from '@nestjs/common';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Module({
  providers: [BullmqOperationalRedisService, WorkerHeartbeatService],
  exports: [BullmqOperationalRedisService],
})
export class WorkerOperationsModule {}
