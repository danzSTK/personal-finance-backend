import { SendEmailMessageUseCase } from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.use-case';
import {
  EmailJobNames,
  NotificationsQueues,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
@Processor(NotificationsQueues.EMAIL)
export class EmailMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailMessageProcessor.name);

  constructor(private readonly sendEmailMessageUseCase: SendEmailMessageUseCase) {
    super();
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
