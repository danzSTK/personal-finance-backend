import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import {
  TransactionAttachmentNotFoundError,
  TransactionNotFoundError,
} from '@/modules/transactions/application/errors';
import { DeleteTransactionAttachmentInput } from '@/modules/transactions/application/use-cases/delete-transaction-attachment/delete-transaction-attachment.dto';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DeleteTransactionAttachmentUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly assetRepository: IAssetRepository,
  ) {}

  async execute(input: DeleteTransactionAttachmentInput): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const tx = await manager.findOne(TransactionOrmEntity, {
        where: { id: input.transactionId, user_id: input.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tx || tx.deleted_at !== null) {
        throw new TransactionNotFoundError();
      }

      const attachment = await this.attachmentRepository.findByIdAndTransactionId(
        input.attachmentId,
        input.transactionId,
        { manager },
      );

      if (!attachment) {
        throw new TransactionAttachmentNotFoundError();
      }

      // Remove attachment link
      await this.attachmentRepository.delete(input.attachmentId, { manager });

      // Reorder remaining positions (0..N-1)
      const remaining = await this.attachmentRepository.findByTransactionId(input.transactionId, { manager });
      const newPositions = remaining.map((item, index) => ({
        id: item.id,
        position: index,
      }));

      await this.attachmentRepository.reorderPositions(input.transactionId, newPositions, { manager });

      // Mark linked asset for deletion
      const asset = await this.assetRepository.findByIdAndUserId(attachment.assetId, input.userId, { manager });

      if (asset && (asset.status === AssetStatus.READY || asset.status === AssetStatus.FAILED)) {
        asset.markDeletePending();
        await this.assetRepository.save(asset, { manager });
      }
    });
  }
}
