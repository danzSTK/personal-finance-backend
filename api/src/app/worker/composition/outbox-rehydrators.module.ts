import { UserAvatarRemovedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-removed-event.rehydrator';
import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';
import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { UserEmailVerifiedEventHydrator } from '@/modules/users/infrastructure/events/user-email-verified-event.rehydrator';
import { UsersEventsModule } from '@/modules/users/users-events.module';
import { EventRegistry, OutboxRegistryModule } from '@/shared/outbox';
import { Module, OnModuleInit } from '@nestjs/common';
import { AuthEventsModule } from '@/modules/auth/auth-events.module';
import { PasswordChangeBlockStartedEventRehydrator } from '@/modules/auth/infrastructure/events/password-change-block-started-event.rehydrator';
import { PasswordChangeStateRefreshRequestedEventRehydrator } from '@/modules/auth/infrastructure/events/password-change-state-refresh-requested-event.rehydrator';
import { PasswordChangedEventRehydrator } from '@/modules/auth/infrastructure/events/password-changed-event.rehydrator';
import { UserSessionsRevokeAllRequestedEventRehydrator } from '@/modules/auth/infrastructure/events/user-sessions-revoke-all-requested-event.rehydrator';

@Module({
  imports: [OutboxRegistryModule, UsersEventsModule, AuthEventsModule],
})
export class OutboxRehydratorsModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistry,
    private readonly userCreatedEventHydrator: UserCreatedEventHydrator,
    private readonly userEmailVerifiedEventHydrator: UserEmailVerifiedEventHydrator,
    private readonly userAvatarUpdatedEventHydrator: UserAvatarUpdatedEventHydrator,
    private readonly userAvatarRemovedEventHydrator: UserAvatarRemovedEventHydrator,
    private readonly passwordChangeStateRefreshRequestedEventRehydrator: PasswordChangeStateRefreshRequestedEventRehydrator,
    private readonly passwordChangedEventRehydrator: PasswordChangedEventRehydrator,
    private readonly passwordChangeBlockStartedEventRehydrator: PasswordChangeBlockStartedEventRehydrator,
    private readonly userSessionsRevokeAllRequestedEventRehydrator: UserSessionsRevokeAllRequestedEventRehydrator,
  ) {}

  onModuleInit(): void {
    this.eventRegistry.register(this.userCreatedEventHydrator);
    this.eventRegistry.register(this.userEmailVerifiedEventHydrator);
    this.eventRegistry.register(this.userAvatarUpdatedEventHydrator);
    this.eventRegistry.register(this.userAvatarRemovedEventHydrator);
    this.eventRegistry.register(this.passwordChangeStateRefreshRequestedEventRehydrator);
    this.eventRegistry.register(this.passwordChangedEventRehydrator);
    this.eventRegistry.register(this.passwordChangeBlockStartedEventRehydrator);
    this.eventRegistry.register(this.userSessionsRevokeAllRequestedEventRehydrator);
  }
}
