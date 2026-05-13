import { DomainEvent } from '@/shared/events';
import { OutboxEventMapper } from '@/shared/outbox/outbox-event.mapper';
import { OutboxMessageRepository } from '@/shared/outbox/outbox-message.repository';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class OutboxWriter {
  constructor(
    private readonly mapper: OutboxEventMapper,
    private readonly repository: OutboxMessageRepository,
  ) {}

  async saveAll(events: DomainEvent[], options: { manager: EntityManager }): Promise<void> {
    const messages = events.map(event => this.mapper.toPersistence(event));

    await this.repository.saveAll(messages, options);
  }
}
