import { NotificationsProducerModule } from '@/modules/notifications/notifications-producer.module';
import { Module } from '@nestjs/common';
import { EnqueueEmailVerificationOnUserCreatedHandler } from './application/handlers/enqueue-email-verification-on-user-created.handler';
import { AuthEmailVerificationCoreModule } from './auth-email-verification-core.module';

@Module({
  imports: [AuthEmailVerificationCoreModule, NotificationsProducerModule],
  providers: [EnqueueEmailVerificationOnUserCreatedHandler],
})
export class AuthEventHandlersModule {}
