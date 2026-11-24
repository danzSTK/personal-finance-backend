export interface ReorderAttachmentItemInput {
  id: string;
  position: number;
}

export interface ReorderTransactionAttachmentsInput {
  userId: string;
  transactionId: string;
  positions: ReorderAttachmentItemInput[];
}
