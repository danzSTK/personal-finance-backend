import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';

export interface TransactionAttachmentWithAsset {
  attachment: TransactionAttachment;
  asset: Asset;
}

export abstract class ITransactionAttachmentRepository {
  abstract findByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<TransactionAttachment[]>;

  abstract findByIdAndTransactionId(
    id: string,
    transactionId: string,
    options?: IRepositoryOptions,
  ): Promise<TransactionAttachment | null>;

  abstract findReadyByTransactionId(
    transactionId: string,
    options?: IRepositoryOptions,
  ): Promise<TransactionAttachmentWithAsset[]>;

  abstract countActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<number>;

  abstract countActiveByTransactionIds(
    transactionIds: string[],
    options?: IRepositoryOptions,
  ): Promise<Map<string, number>>;

  abstract save(attachment: TransactionAttachment, options?: IRepositoryOptions): Promise<TransactionAttachment>;

  abstract saveAll(
    attachments: TransactionAttachment[],
    options?: IRepositoryOptions,
  ): Promise<TransactionAttachment[]>;

  abstract delete(id: string, options?: IRepositoryOptions): Promise<void>;

  abstract reorderPositions(
    transactionId: string,
    positions: Array<{ id: string; position: number }>,
    options?: IRepositoryOptions,
  ): Promise<void>;
}
