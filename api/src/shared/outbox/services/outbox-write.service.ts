import { DomainEvent } from '@/shared/events';
import { OutboxEventMapper } from '@/shared/outbox/mappers/outbox-event.mapper';
import { OutboxMessageRepository } from '@/shared/outbox/persistence/outbox-message.repository';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class OutboxWriteService {
  constructor(private readonly outboxRepository: OutboxMessageRepository) {}

  async storeEvents(events: DomainEvent[], options: { manager: EntityManager }): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const outboxMessages = events.map(event => OutboxEventMapper.toOutboxEvent(event));

    await this.outboxRepository.saveAll(outboxMessages, options);
  }
}
