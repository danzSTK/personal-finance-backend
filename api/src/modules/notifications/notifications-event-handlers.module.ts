import { EnqueuePasswordChangeBlockedEmailHandler } from '@/modules/notifications/application/handlers/enqueue-password-change-blocked-email.handler';
import { EnqueuePasswordChangedEmailHandler } from '@/modules/notifications/application/handlers/enqueue-password-changed-email.handler';
import { Module } from '@nestjs/common';
import { EnqueueWelcomeEmailOnUserCreatedHandler } from './application/handlers/enqueue-welcome-email-on-user-created.handler';
import { EnqueueWelcomeEmailOnUserEmailVerifiedHandler } from './application/handlers/enqueue-welcome-email-on-user-email-verified.handler';
import { NotificationsProducerModule } from './notifications-producer.module';

@Module({
  imports: [NotificationsProducerModule],
  providers: [
    EnqueueWelcomeEmailOnUserCreatedHandler,
    EnqueueWelcomeEmailOnUserEmailVerifiedHandler,
    EnqueuePasswordChangeBlockedEmailHandler,
    EnqueuePasswordChangedEmailHandler,
  ],
})
export class NotificationsEventHandlersModule {}
