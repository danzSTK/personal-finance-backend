import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { DeleteTransactionUseCaseInput } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.dto';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';

@Injectable()
export class DeleteTransactionUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly assetRepository: IAssetRepository,
  ) {}

  async execute(input: DeleteTransactionUseCaseInput): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const txOrm = await manager.findOne(TransactionOrmEntity, {
        where: {
          id: input.transactionId,
          user_id: input.userId,
          deleted_at: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!txOrm) {
        throw new TransactionNotFoundError();
      }

      const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId, {
        manager,
      });

      if (!transaction) {
        throw new TransactionNotFoundError();
      }

      transaction.delete();
      await this.transactionRepository.save(transaction, { manager });

      const attachments = await this.attachmentRepository.findByTransactionId(input.transactionId, { manager });

      for (const attachment of attachments) {
        const asset = await this.assetRepository.findByIdAndUserId(attachment.assetId, input.userId, { manager });

        if (asset && (asset.status === AssetStatus.READY || asset.status === AssetStatus.FAILED)) {
          asset.markDeletePending();
          await this.assetRepository.save(asset, { manager });
        }
      }
    });
  }
}
