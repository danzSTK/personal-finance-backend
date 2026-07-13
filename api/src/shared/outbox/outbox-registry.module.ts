import { Module } from '@nestjs/common';
import { EventRegistry } from './event-registry';

@Module({
  providers: [EventRegistry],
  exports: [EventRegistry],
})
export class OutboxRegistryModule {}
