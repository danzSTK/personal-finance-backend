import workerConfig from '@/config/worker.config';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class EmailMessageEnqueueReconciler implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(EmailMessageEnqueueReconciler.name);
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isDraining = false;

  constructor(
    private readonly repository: IEmailMessageRepository,
    private readonly producer: EmailJobQueueProducer,
    @Inject(workerConfig.KEY)
    private readonly config: ConfigType<typeof workerConfig>,
  ) {}

  onModuleInit(): void {
    this.interval = setInterval(() => void this.reconcile(), this.config.emailReconciliation.intervalMs);
    this.interval.unref();
  }

  beforeApplicationShutdown(): void {
    this.isDraining = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async reconcile(): Promise<void> {
    if (this.isRunning || this.isDraining) {
      return;
    }

    this.isRunning = true;
    try {
      const cutoff = new Date(Date.now() - this.config.emailReconciliation.staleAfterMs);
      const messages = await this.repository.findReenqueuableBefore(cutoff, this.config.emailReconciliation.batchSize);

      for (const message of messages) {
        try {
          await this.producer.enqueueEmailMessage(message.id);
        } catch (error) {
          this.logger.error(
            `Failed to reconcile email message enqueue. emailMessageId=${message.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
