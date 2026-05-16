import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { Module } from '@nestjs/common';

@Module({
  providers: [UserCreatedEventHydrator],
  exports: [UserCreatedEventHydrator],
})
export class UsersEventsModule {}
