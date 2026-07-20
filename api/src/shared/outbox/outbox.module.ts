import { Module } from '@nestjs/common';
import { OutboxWriterModule } from './outbox-writer.module';

@Module({
  imports: [OutboxWriterModule],
  exports: [OutboxWriterModule],
})
export class OutboxModule {}
