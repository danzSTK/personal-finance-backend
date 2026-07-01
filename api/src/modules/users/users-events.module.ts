import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';
import { UserAvatarRemovedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-removed-event.rehydrator';
import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { UserEmailVerifiedEventHydrator } from '@/modules/users/infrastructure/events/user-email-verified-event.rehydrator';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    UserCreatedEventHydrator,
    UserEmailVerifiedEventHydrator,
    UserAvatarUpdatedEventHydrator,
    UserAvatarRemovedEventHydrator,
  ],
  exports: [
    UserCreatedEventHydrator,
    UserEmailVerifiedEventHydrator,
    UserAvatarUpdatedEventHydrator,
    UserAvatarRemovedEventHydrator,
  ],
})
export class UsersEventsModule {}
