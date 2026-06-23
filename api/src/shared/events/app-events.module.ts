import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppEventPublisher } from './app-event-publisher.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      delimiter: '.',
      wildcard: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
  ],
  providers: [AppEventPublisher],
  exports: [AppEventPublisher],
})
export class AppEventsModule {}
