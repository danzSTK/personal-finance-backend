import { AppEventPublisher } from '@/shared/events';
import { EventRegistry } from '@/shared/outbox/event-registry';
import { OutboxMessageRepository } from '@/shared/outbox/persistence/outbox-message.repository';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'crypto';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly lockedBy = `outbox-${process.pid}-${randomUUID()}`;
  private isProcessing = false;

  constructor(
    private readonly repository: OutboxMessageRepository,
    private readonly eventPublisher: AppEventPublisher,
    private readonly eventRegistry: EventRegistry,
  ) {}

  @Interval('outbox-processor', 1000)
  async processReadyMessages(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.processBatch();
    } catch (error) {
      this.logger.error('Error processing outbox messages', error instanceof Error ? error.stack : String(error));
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatch(): Promise<void> {
    const messages = await this.repository.claimReadyBatch({ lockedBy: this.lockedBy, limit: 25, lockForMs: 30_000 });

    for (const message of messages) {
      try {
        const event = this.eventRegistry.rehydrate(message);

        await this.eventPublisher.emitAsync(event);

        await this.repository.markPublished(message.id);
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(`Failed to publish outbox message ${message.id}: ${error.message}`, error.stack);
        } else {
          this.logger.error(`Failed to publish outbox message ${message.id}: ${String(error)}`);
        }

        await this.repository.markFailed(message, error);
      }
    }
  }
}
