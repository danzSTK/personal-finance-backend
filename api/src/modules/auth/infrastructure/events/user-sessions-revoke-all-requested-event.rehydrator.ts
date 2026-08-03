import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const payloadSchema = z
  .object({
    userId: z.uuid(),
    sourceEventId: z.uuid(),
  })
  .strict();

@Injectable()
export class UserSessionsRevokeAllRequestedEventRehydrator implements EventRehydrator {
  readonly eventName = UserSessionsRevokeAllRequestedEvent.eventName;
  readonly eventVersion = UserSessionsRevokeAllRequestedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): UserSessionsRevokeAllRequestedEvent {
    const payload = payloadSchema.parse(input.payload);

    return UserSessionsRevokeAllRequestedEvent.rehydrate({
      ...payload,
      occurredAt: input.occurredAt,
    });
  }
}
