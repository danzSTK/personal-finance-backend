import { SendEmailMessageUseCase } from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.use-case';
import {
  EmailJobNames,
  NotificationsQueues,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Inject, OnApplicationBootstrap } from '@nestjs/common';
import queueConfig from '@/config/queue.config';
import type { ConfigType } from '@nestjs/config';
import { Job } from 'bullmq';

@Injectable()
@Processor(NotificationsQueues.EMAIL)
export class EmailMessageProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailMessageProcessor.name);

  constructor(
    private readonly sendEmailMessageUseCase: SendEmailMessageUseCase,
    @Inject(queueConfig.KEY)
    private readonly queueConfiguration: ConfigType<typeof queueConfig>,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.concurrency = this.queueConfiguration.workers.defaultConcurrency;
  }

  async process(job: Job<SendEmailMessageJobPayload>): Promise<void> {
    if (job.name !== EmailJobNames.SEND_EMAIL_MESSAGE) {
      throw new Error(`Unsupported notifications email job: ${job.name}`);
    }

    const result = await this.sendEmailMessageUseCase.execute({ emailMessageId: job.data.emailMessageId });

    if (!result.sent) {
      this.logger.warn(
        `Email message job completed without sending. jobId=${job.id ?? 'unknown'} emailMessageId=${job.data.emailMessageId} status=${result.status}`,
      );
    }
  }
}
