import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEventMapper } from './outbox-event.mapper';
import { OutboxMessageOrmEntity } from './outbox-message-orm.entity';
import { OutboxMessageRepository } from './outbox-message.repository';
import { OutboxProcessor } from './services/outbox-processor.service';
import { OutboxWriter } from './services/outbox-writer.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([OutboxMessageOrmEntity])],
  controllers: [],
  providers: [OutboxEventMapper, OutboxMessageRepository, OutboxWriter, OutboxProcessor],
  exports: [OutboxWriter],
})
export class OutboxModule {}
