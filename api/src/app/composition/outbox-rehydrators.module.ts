import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';
import { UserAvatarRemovedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-removed-event.rehydrator';
import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { UserEmailVerifiedEventHydrator } from '@/modules/users/infrastructure/events/user-email-verified-event.rehydrator';
import { UsersEventsModule } from '@/modules/users/users-events.module';
import { EventRegistry, OutboxRegistryModule } from '@/shared/outbox';
import { Module, OnModuleInit } from '@nestjs/common';

@Module({
  imports: [OutboxRegistryModule, UsersEventsModule],
})
export class OutboxRehydratorsModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistry,
    private readonly userCreatedEventHydrator: UserCreatedEventHydrator,
    private readonly userEmailVerifiedEventHydrator: UserEmailVerifiedEventHydrator,
    private readonly userAvatarUpdatedEventHydrator: UserAvatarUpdatedEventHydrator,
    private readonly userAvatarRemovedEventHydrator: UserAvatarRemovedEventHydrator,
  ) {}

  onModuleInit(): void {
    this.eventRegistry.register(this.userCreatedEventHydrator);
    this.eventRegistry.register(this.userEmailVerifiedEventHydrator);
    this.eventRegistry.register(this.userAvatarUpdatedEventHydrator);
    this.eventRegistry.register(this.userAvatarRemovedEventHydrator);
  }
}
