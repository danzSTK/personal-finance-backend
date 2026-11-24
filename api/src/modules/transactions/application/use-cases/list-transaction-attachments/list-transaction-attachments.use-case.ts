import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import {
  ListTransactionAttachmentsInput,
  ListTransactionAttachmentsOutput,
} from '@/modules/transactions/application/use-cases/list-transaction-attachments/list-transaction-attachments.dto';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { IObjectStorage } from '@/shared/object-storage';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ListTransactionAttachmentsUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly objectStorage: IObjectStorage,
  ) {}

  async execute(input: ListTransactionAttachmentsInput): Promise<ListTransactionAttachmentsOutput> {
    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    const readyAttachments = await this.attachmentRepository.findReadyByTransactionId(input.transactionId);

    const outputs: ListTransactionAttachmentsOutput = [];

    for (const item of readyAttachments) {
      const signed = await this.objectStorage.buildSignedReadUrl({
        bucket: item.asset.bucket,
        key: item.asset.storageKey,
      });

      outputs.push({
        id: item.attachment.id,
        assetId: item.attachment.assetId,
        position: item.attachment.position,
        contentType: item.asset.contentType ?? 'application/octet-stream',
        sizeBytes: item.asset.sizeBytes ?? 0,
        url: signed.url,
        expiresAt: signed.expiresAt,
        cacheMaxAgeSeconds: signed.cacheMaxAgeSeconds,
      });
    }

    return outputs;
  }
}
