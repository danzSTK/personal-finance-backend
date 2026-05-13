import { DomainEvent } from '@/shared/events';
import { OutboxMessageStatus } from '@/shared/outbox';
import { Injectable } from '@nestjs/common';
import { CreateOutboxMessageInput } from './outbox-message.repository';

@Injectable()
export class OutboxEventMapper {
  toPersistence(domainEvent: DomainEvent): CreateOutboxMessageInput {
    return {
      eventName: domainEvent.eventName,
      eventVersion: domainEvent.eventVersion,
      aggregateType: domainEvent.aggregateType,
      aggregateId: domainEvent.aggregateId,
      deduplicationKey: domainEvent.deduplicationKey ?? null,
      payload: domainEvent.toPayload(),
      metadata: {},
      status: OutboxMessageStatus.PENDING,
      occurredAt: domainEvent.occurredAt,
    };
  }
}
