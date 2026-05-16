import { EventRegistry } from '@/shared/outbox/event-registry';
import { OutboxProcessorService } from '@/shared/outbox/services/outbox-processor.service';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxMessageOrmEntity } from './persistence/outbox-message-orm.entity';
import { OutboxMessageRepository } from './persistence/outbox-message.repository';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([OutboxMessageOrmEntity])],
  controllers: [],
  providers: [OutboxMessageRepository, EventRegistry, OutboxProcessorService, OutboxWriteService],
  exports: [EventRegistry, OutboxWriteService],
})
export class OutboxModule {}
