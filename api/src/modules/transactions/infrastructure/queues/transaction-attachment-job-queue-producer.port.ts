import { TransactionAttachmentOptimizeJobPayload } from '@/modules/transactions/infrastructure/queues/transaction-attachment-queue.constants';

export abstract class TransactionAttachmentJobQueueProducer {
  abstract enqueueOptimizationJob(payload: TransactionAttachmentOptimizeJobPayload): Promise<void>;
}
