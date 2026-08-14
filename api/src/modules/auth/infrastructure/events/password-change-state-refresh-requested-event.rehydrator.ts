import { PasswordChangeStateRefreshRequestedEvent } from '@/modules/auth/domain/events/password-change-state-refresh-requested.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const payloadSchema = z
  .object({
    userId: z.uuid(),
    sourceEventId: z.uuid(),
    mutationToken: z.uuid().nullable(),
  })
  .strict();

@Injectable()
export class PasswordChangeStateRefreshRequestedEventRehydrator implements EventRehydrator {
  readonly eventName = PasswordChangeStateRefreshRequestedEvent.eventName;
  readonly eventVersion = PasswordChangeStateRefreshRequestedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): PasswordChangeStateRefreshRequestedEvent {
    const payload = payloadSchema.parse(input.payload);

    return PasswordChangeStateRefreshRequestedEvent.rehydrate({
      ...payload,
      occurredAt: input.occurredAt,
    });
  }
}
