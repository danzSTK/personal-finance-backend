export interface ListTransactionAttachmentsInput {
  userId: string;
  transactionId: string;
}

export interface TransactionAttachmentOutputItem {
  id: string;
  assetId: string;
  position: number;
  contentType: string;
  sizeBytes: number;
  url: string;
  expiresAt: Date;
  cacheMaxAgeSeconds: number;
}

export type ListTransactionAttachmentsOutput = TransactionAttachmentOutputItem[];
