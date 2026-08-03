import { PasswordChangeBlockStartedEvent } from '@/modules/auth/domain/events/password-change-block-started.event';
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
    blockedUntil: z.iso.datetime(),
    securityContext: securityContextSchema,
  })
  .strict();

@Injectable()
export class PasswordChangeBlockStartedEventRehydrator implements EventRehydrator {
  readonly eventName = PasswordChangeBlockStartedEvent.eventName;
  readonly eventVersion = PasswordChangeBlockStartedEvent.eventVersion;

  rehydrate(input: RehydrateEventInput): PasswordChangeBlockStartedEvent {
    const payload = payloadSchema.parse(input.payload);

    return PasswordChangeBlockStartedEvent.rehydrate({
      ...payload,
      blockedUntil: new Date(payload.blockedUntil),
      occurredAt: input.occurredAt,
    });
  }
}
