import workerConfig from '@/config/worker.config';
import { AppEventPublisher } from '@/shared/events';
import { EventRegistry } from '@/shared/outbox/event-registry';
import { OutboxMessageOrmEntity } from '@/shared/outbox/persistence/outbox-message-orm.entity';
import { OutboxMessageRepository } from '@/shared/outbox/persistence/outbox-message.repository';
import { BeforeApplicationShutdown, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { EventEmitterReadinessWatcher } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';

@Injectable()
export class OutboxProcessorService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly lockedBy = `outbox-${process.pid}-${randomUUID()}`;
  private interval: NodeJS.Timeout | null = null;
  private isStarted = false;
  private isProcessing = false;
  private isDraining = false;

  constructor(
    private readonly repository: OutboxMessageRepository,
    private readonly eventPublisher: AppEventPublisher,
    private readonly eventRegistry: EventRegistry,
    private readonly eventEmitterReadiness: EventEmitterReadinessWatcher,
    @Inject(workerConfig.KEY)
    private readonly config: ConfigType<typeof workerConfig>,
  ) {}

  async start(): Promise<void> {
    if (this.isStarted || this.isDraining) {
      return;
    }

    await this.eventEmitterReadiness.waitUntilReady();

    if (this.isStarted || this.isDraining) {
      return;
    }

    this.isStarted = true;
    this.interval = setInterval(() => void this.processReadyMessages(), this.config.outbox.pollIntervalMs);
    this.interval.unref();
    void this.processReadyMessages();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.isDraining = true;
    this.isStarted = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const deadline = Date.now() + this.config.shutdownTimeoutMs;
    while (this.isProcessing && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async processReadyMessages(): Promise<void> {
    if (this.isProcessing || this.isDraining) {
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
    const limit = Math.min(this.config.outbox.batchSize, this.config.outbox.concurrency);
    const messages = await this.repository.claimReadyBatch({
      lockedBy: this.lockedBy,
      limit,
      lockForMs: this.config.outbox.leaseMs,
    });

    await Promise.all(messages.map(message => this.processMessage(message)));
  }

  private async processMessage(message: OutboxMessageOrmEntity): Promise<void> {
    const leaseRenewal = setInterval(() => void this.renewLease(message), this.config.outbox.leaseRenewIntervalMs);
    leaseRenewal.unref();

    try {
      const event = this.eventRegistry.rehydrate(message);
      await this.eventPublisher.emitAsync(event);

      const marked = await this.repository.markPublished(message.id, this.lockedBy);
      if (!marked) {
        this.logLeaseLost(message, 'publish');
      }
    } catch (error) {
      this.logProcessingError(message, error);

      const marked = await this.repository.markFailed(message, this.lockedBy, error);
      if (!marked) {
        this.logLeaseLost(message, 'fail');
      }
    } finally {
      clearInterval(leaseRenewal);
    }
  }

  private async renewLease(message: OutboxMessageOrmEntity): Promise<void> {
    try {
      const renewed = await this.repository.extendLease(message.id, this.lockedBy, this.config.outbox.leaseMs);
      if (!renewed) {
        this.logLeaseLost(message, 'renew');
      }
    } catch (error) {
      this.logger.error(
        `Failed to renew outbox lease. outboxMessageId=${message.id} lockedBy=${this.lockedBy}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private logProcessingError(message: OutboxMessageOrmEntity, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Failed to process outbox message. outboxMessageId=${message.id} eventName=${message.eventName} attempt=${message.attempts} lockedBy=${this.lockedBy} error=${detail}`,
      error instanceof Error ? error.stack : undefined,
    );
  }

  private logLeaseLost(message: OutboxMessageOrmEntity, operation: string): void {
    this.logger.warn(
      `Outbox lease lost. outboxMessageId=${message.id} eventName=${message.eventName} operation=${operation} lockedBy=${this.lockedBy}`,
    );
  }
}
