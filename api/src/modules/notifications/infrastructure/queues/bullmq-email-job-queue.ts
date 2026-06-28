import { EmailJobQueue } from '@/modules/notifications/application/queues/email-job-queue.port';
import {
  EmailJobIds,
  EmailJobNames,
  NotificationsQueues,
  SendEmailMessageJobPayload,
} from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class BullmqEmailJobQueue implements EmailJobQueue {
  constructor(
    @InjectQueue(NotificationsQueues.EMAIL)
    private readonly queue: Queue<SendEmailMessageJobPayload>,
  ) {}

  async enqueueEmailMessage(emailMessageId: string): Promise<void> {
    await this.queue.add(
      EmailJobNames.SEND_EMAIL_MESSAGE,
      { emailMessageId },
      {
        jobId: EmailJobIds.emailMessage(emailMessageId),
      },
    );
  }
}
