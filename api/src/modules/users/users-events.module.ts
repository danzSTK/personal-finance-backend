import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';
import { UserAvatarRemovedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-removed-event.rehydrator';
import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { Module } from '@nestjs/common';

@Module({
  providers: [UserCreatedEventHydrator, UserAvatarUpdatedEventHydrator, UserAvatarRemovedEventHydrator],
  exports: [UserCreatedEventHydrator, UserAvatarUpdatedEventHydrator, UserAvatarRemovedEventHydrator],
})
export class UsersEventsModule {}
