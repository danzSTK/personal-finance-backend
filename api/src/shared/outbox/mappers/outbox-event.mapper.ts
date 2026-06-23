import { OutboxMessageStatus } from '@/common/models/enums';
import { DomainEvent } from '@/shared/events';
import { CreateOutboxEventInput } from '@/shared/outbox/interfaces/outbox-event.interface';

export class OutboxEventMapper {
  static toOutboxEvent(event: DomainEvent): CreateOutboxEventInput {
    return {
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      deduplicationKey: event.deduplicationKey ?? null,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      metadata: {},
      payload: event.toPayload(),
      occurredAt: event.occurredAt,
      status: OutboxMessageStatus.PENDING,
    };
  }
}
