export interface AttachmentFileInput {
  buffer: Buffer;
  originalname: string;
}

export interface AddTransactionAttachmentsInput {
  userId: string;
  transactionId: string;
  files: AttachmentFileInput[];
}

export interface AddedAttachmentOutput {
  id: string;
  assetId: string;
  position: number;
  contentType: string;
  sizeBytes: number;
  url: string;
  expiresAt: Date;
  cacheMaxAgeSeconds: number;
}

export type AddTransactionAttachmentsOutput = AddedAttachmentOutput[];
