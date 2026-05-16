import type { DomainEvent } from '@/shared/events';
import type { EventRehydrator } from '@/shared/outbox/interfaces/outbox-event-rehydrator.interface';
import type { OutboxMessageOrmEntity } from '@/shared/outbox/persistence/outbox-message-orm.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventRegistry {
  private readonly rehydrators = new Map<string, EventRehydrator>();

  register(rehydrator: EventRehydrator): void {
    const key = this.getKey(rehydrator.eventName, rehydrator.eventVersion);

    if (this.rehydrators.has(key)) {
      throw new Error(
        `Rehydrator for event ${rehydrator.eventName} version ${rehydrator.eventVersion} is already registered.`,
      );
    }

    this.rehydrators.set(key, rehydrator);
  }

  rehydrate(message: OutboxMessageOrmEntity): DomainEvent {
    const key = this.getKey(message.eventName, message.eventVersion);
    const rehydrator = this.rehydrators.get(key);

    if (!rehydrator) {
      throw new Error(`No rehydrator found for event ${message.eventName} version ${message.eventVersion}.`);
    }

    return rehydrator.rehydrate({
      aggregateId: message.aggregateId,
      occurredAt: message.occurredAt,
      metadata: message.metadata,
      payload: message.payload,
    });
  }

  private getKey(eventName: string, eventVersion: number): string {
    return `${eventName}_v${eventVersion}`;
  }
}
