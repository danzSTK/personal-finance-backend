import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { UsersEventsModule } from '@/modules/users/users-events.module';
import { EventRegistry, OutboxModule } from '@/shared/outbox';
import { Module, OnModuleInit } from '@nestjs/common';

@Module({
  imports: [OutboxModule, UsersEventsModule],
})
export class OutboxRehydratorsModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistry,
    private readonly userCreatedEventHydrator: UserCreatedEventHydrator,
  ) {}

  onModuleInit(): void {
    this.eventRegistry.register(this.userCreatedEventHydrator);
  }
}
