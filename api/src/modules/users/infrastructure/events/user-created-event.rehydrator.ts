import { UserStatus } from '@/common/models/enums';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const UserCreatedPayloadSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  status: z.enum(Object.values(UserStatus)),
});

@Injectable()
export class UserCreatedEventHydrator implements EventRehydrator {
  readonly eventName = UserCreatedEvent.eventName;
  readonly eventVersion = UserCreatedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): UserCreatedEvent {
    const payload = UserCreatedPayloadSchema.parse(input.payload);

    return UserCreatedEvent.rehydrate({
      userId: payload.userId,
      status: payload.status,
      email: payload.email,
      occurredAt: input.occurredAt,
    });
  }
}
