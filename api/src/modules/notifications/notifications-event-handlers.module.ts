import { Module } from '@nestjs/common';
import { EnqueueWelcomeEmailOnUserCreatedHandler } from './application/handlers/enqueue-welcome-email-on-user-created.handler';
import { EnqueueWelcomeEmailOnUserEmailVerifiedHandler } from './application/handlers/enqueue-welcome-email-on-user-email-verified.handler';
import { NotificationsProducerModule } from './notifications-producer.module';

@Module({
  imports: [NotificationsProducerModule],
  providers: [EnqueueWelcomeEmailOnUserCreatedHandler, EnqueueWelcomeEmailOnUserEmailVerifiedHandler],
})
export class NotificationsEventHandlersModule {}
