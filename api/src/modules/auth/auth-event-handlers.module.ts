import { NotificationsProducerModule } from '@/modules/notifications/notifications-producer.module';
import { Module } from '@nestjs/common';
import { EnqueueEmailVerificationOnUserCreatedHandler } from './application/handlers/enqueue-email-verification-on-user-created.handler';
import { AuthEmailVerificationCoreModule } from './auth-email-verification-core.module';
import { AuthPasswordChangeCoreModule } from './auth-password-change-core.module';
import { AuthSessionCoreModule } from './auth-session-core.module';
import { RefreshPasswordChangeStateOnRequestedHandler } from './application/handlers/refresh-password-change-state-on-requested.handler';
import { RevokeAllUserSessionsOnRequestedHandler } from './application/handlers/revoke-all-user-sessions-on-requested.handler';

@Module({
  imports: [
    AuthEmailVerificationCoreModule,
    AuthPasswordChangeCoreModule,
    AuthSessionCoreModule,
    NotificationsProducerModule,
  ],
  providers: [
    EnqueueEmailVerificationOnUserCreatedHandler,
    RefreshPasswordChangeStateOnRequestedHandler,
    RevokeAllUserSessionsOnRequestedHandler,
  ],
})
export class AuthEventHandlersModule {}
