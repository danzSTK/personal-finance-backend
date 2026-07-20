import { Global, Module } from '@nestjs/common';
import { OutboxPersistenceModule } from './outbox-persistence.module';
import { OutboxWriteService } from './services/outbox-write.service';

@Global()
@Module({
  imports: [OutboxPersistenceModule],
  providers: [OutboxWriteService],
  exports: [OutboxWriteService],
})
export class OutboxWriterModule {}
