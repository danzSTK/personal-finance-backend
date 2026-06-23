import { UserAvatarRemovedEvent } from '@/modules/users/domain/events/user-avatar-removed.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const UserAvatarRemovedPayloadSchema = z.object({
  userId: z.uuid(),
  previousAssetId: z.uuid(),
});

@Injectable()
export class UserAvatarRemovedEventHydrator implements EventRehydrator {
  readonly eventName = UserAvatarRemovedEvent.eventName;
  readonly eventVersion = UserAvatarRemovedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): UserAvatarRemovedEvent {
    const payload = UserAvatarRemovedPayloadSchema.parse(input.payload);

    return UserAvatarRemovedEvent.rehydrate({
      ...payload,
      occurredAt: input.occurredAt,
    });
  }
}
