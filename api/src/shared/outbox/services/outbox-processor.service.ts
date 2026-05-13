import { OutboxMessageRepository } from '@/shared/outbox/outbox-message.repository';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private readonly lockedBy = `outbox-${process.pid}-${randomUUID()}`;
  private isProcessing = false;

  constructor(
    private readonly repository: OutboxMessageRepository,
    private readonly eventEmitter: EventEmitter2,
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
      this.logger.error('Failed to process outbox batch', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatch(): Promise<void> {
    const messages = await this.repository.claimReadyBatch({
      limit: 25,
      lockedBy: this.lockedBy,
      lockForMs: 30_000,
    });

    for (const message of messages) {
      try {
        await this.eventEmitter.emitAsync(message.eventName, message.payload);
        await this.repository.markPublished(message.id);
      } catch (error) {
        await this.repository.markFailed(message, error, this.calculateNextRetryAt(message.attempts));
        this.logger.error(`Failed to publish outbox message ${message.id}`, error);
      }
    }
  }

  private calculateNextRetryAt(attempts: number): Date {
    const retryDelayMs = Math.min(60_000, 1000 * 2 ** Math.max(attempts - 1, 0));

    return new Date(Date.now() + retryDelayMs);
  }
}
