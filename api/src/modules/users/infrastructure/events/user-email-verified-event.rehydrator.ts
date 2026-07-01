import { UserEmailVerifiedEvent } from '@/modules/users/domain/events/user-email-verified.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const UserEmailVerifiedPayloadSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
});

@Injectable()
export class UserEmailVerifiedEventHydrator implements EventRehydrator {
  readonly eventName = UserEmailVerifiedEvent.eventName;
  readonly eventVersion = UserEmailVerifiedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): UserEmailVerifiedEvent {
    const payload = UserEmailVerifiedPayloadSchema.parse(input.payload);

    return UserEmailVerifiedEvent.rehydrate({
      userId: payload.userId,
      email: payload.email,
      occurredAt: input.occurredAt,
    });
  }
}
