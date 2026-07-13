import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxMessageOrmEntity } from './persistence/outbox-message-orm.entity';
import { OutboxMessageRepository } from './persistence/outbox-message.repository';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessageOrmEntity])],
  providers: [OutboxMessageRepository],
  exports: [OutboxMessageRepository],
})
export class OutboxPersistenceModule {}
