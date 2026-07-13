import { AppEventsModule } from '@/shared/events';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxPersistenceModule } from './outbox-persistence.module';
import { OutboxRegistryModule } from './outbox-registry.module';
import { OutboxProcessorService } from './services/outbox-processor.service';

@Module({
  imports: [ScheduleModule.forRoot(), AppEventsModule, OutboxPersistenceModule, OutboxRegistryModule],
  providers: [OutboxProcessorService],
  exports: [OutboxProcessorService],
})
export class OutboxDispatcherModule {}
