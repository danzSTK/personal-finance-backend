import { ConfigModule } from '@/config/config.module';
import { PostgresModule } from '@/database/postgres/postgres.module';
import { RedisModule } from '@/database/redis/redis.module';
import { NotificationsWorkerModule } from '@/modules/notifications/notifications-worker.module';
import { AppEventsModule } from '@/shared/events';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { OutboxDispatcherModule } from '@/shared/outbox';
import { Module } from '@nestjs/common';
import { OutboxRehydratorsModule } from './composition/outbox-rehydrators.module';
import { WorkerEventConsumersModule } from './composition/worker-event-consumers.module';
import { WorkerOperationsModule } from './operations/worker-operations.module';

@Module({
  imports: [
    ConfigModule,
    PostgresModule,
    RedisModule,
    JobsModule,
    AppEventsModule,
    OutboxDispatcherModule,
    OutboxRehydratorsModule,
    WorkerEventConsumersModule,
    NotificationsWorkerModule,
    WorkerOperationsModule,
  ],
})
export class WorkerModule {}
