import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';
import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { Module } from '@nestjs/common';

@Module({
  providers: [UserCreatedEventHydrator, UserAvatarUpdatedEventHydrator],
  exports: [UserCreatedEventHydrator, UserAvatarUpdatedEventHydrator],
})
export class UsersEventsModule {}
