export const TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE = 'transaction-attachments-optimization';
export const TRANSACTION_ATTACHMENT_OPTIMIZE_JOB = 'optimize-transaction-attachment';

export interface TransactionAttachmentOptimizeJobPayload {
  assetId: string;
  userId: string;
}
