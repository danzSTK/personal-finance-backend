import { UserAvatarUpdatedEvent } from '@/modules/users/domain/events/user-avatar-updated.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const UserAvatarUpdatedPayloadSchema = z.object({
  userId: z.uuid(),
  previousAssetId: z.uuid().nullable(),
  currentAssetId: z.uuid(),
});

@Injectable()
export class UserAvatarUpdatedEventHydrator implements EventRehydrator {
  readonly eventName = UserAvatarUpdatedEvent.eventName;
  readonly eventVersion = UserAvatarUpdatedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): UserAvatarUpdatedEvent {
    const payload = UserAvatarUpdatedPayloadSchema.parse(input.payload);

    return UserAvatarUpdatedEvent.rehydrate({
      ...payload,
      occurredAt: input.occurredAt,
    });
  }
}
