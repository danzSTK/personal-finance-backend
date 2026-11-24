import {
  TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
  TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE,
  TransactionAttachmentOptimizeJobPayload,
} from '@/modules/transactions/infrastructure/queues/transaction-attachment-queue.constants';
import { TransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/transaction-attachment-job-queue-producer.port';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class BullmqTransactionAttachmentJobQueueProducer implements TransactionAttachmentJobQueueProducer {
  constructor(
    @InjectQueue(TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE)
    private readonly queue: Queue<TransactionAttachmentOptimizeJobPayload>,
  ) {}

  async enqueueOptimizationJob(payload: TransactionAttachmentOptimizeJobPayload): Promise<void> {
    await this.queue.add(TRANSACTION_ATTACHMENT_OPTIMIZE_JOB, payload);
  }
}
