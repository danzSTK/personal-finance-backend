import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { EventRehydrator, RehydrateEventInput } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const securityContextSchema = z
  .object({
    ipAddress: z.string().max(45).nullable(),
    location: z.string().max(256).nullable(),
    browser: z.string().max(256).nullable(),
    operatingSystem: z.string().max(256).nullable(),
    device: z.string().max(256).nullable(),
  })
  .strict();

const payloadSchema = z
  .object({
    userId: z.uuid(),
    sourceEventId: z.uuid(),
    securityContext: securityContextSchema,
  })
  .strict();

@Injectable()
export class PasswordChangedEventRehydrator implements EventRehydrator {
  readonly eventName = PasswordChangedEvent.eventName;
  readonly eventVersion = PasswordChangedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): PasswordChangedEvent {
    const payload = payloadSchema.parse(input.payload);

    return PasswordChangedEvent.rehydrate({
      ...payload,
      occurredAt: input.occurredAt,
    });
  }
}
