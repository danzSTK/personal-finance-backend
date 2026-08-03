import { PasswordChangeBlockStartedEventRehydrator } from '@/modules/auth/infrastructure/events/password-change-block-started-event.rehydrator';
import { PasswordChangeStateRefreshRequestedEventRehydrator } from '@/modules/auth/infrastructure/events/password-change-state-refresh-requested-event.rehydrator';
import { PasswordChangedEventRehydrator } from '@/modules/auth/infrastructure/events/password-changed-event.rehydrator';
import { UserSessionsRevokeAllRequestedEventRehydrator } from '@/modules/auth/infrastructure/events/user-sessions-revoke-all-requested-event.rehydrator';
import { Module } from '@nestjs/common';

const rehydrators = [
  PasswordChangeStateRefreshRequestedEventRehydrator,
  PasswordChangedEventRehydrator,
  PasswordChangeBlockStartedEventRehydrator,
  UserSessionsRevokeAllRequestedEventRehydrator,
];

@Module({
  providers: rehydrators,
  exports: rehydrators,
})
export class AuthEventsModule {}
