import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { FiscalNoteTransactionLifecyclePort } from '@/modules/fiscal-notes/application/ports';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { DeleteTransactionUseCaseInput } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.dto';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DeleteTransactionUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly assetRepository: IAssetRepository,
    private readonly accountBalanceLockPort: AccountBalanceLockPort,
    private readonly fiscalNoteLifecyclePort: FiscalNoteTransactionLifecyclePort,
  ) {}

  async execute(input: DeleteTransactionUseCaseInput): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const options = { manager };
      const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
        input.transactionId,
        input.userId,
        options,
      );

      if (!transaction) {
        throw new TransactionNotFoundError();
      }

      transaction.delete();

      const accountIdsToLock = [transaction.accountId, transaction.destinationAccountId].filter(
        (id): id is string => id !== null,
      );

      await this.accountBalanceLockPort.lockAccountsForBalanceMutation(
        {
          userId: input.userId,
          accountIds: accountIdsToLock,
        },
        options,
      );

      await this.transactionRepository.save(transaction, options);
      await this.fiscalNoteLifecyclePort.softDeleteByTransactionId(input.transactionId, input.userId, options);

      const attachments = await this.attachmentRepository.findByTransactionId(input.transactionId, options);

      for (const attachment of attachments) {
        const asset = await this.assetRepository.findByIdAndUserId(attachment.assetId, input.userId, options);

        if (asset?.canMarkDeletePending()) {
          asset.markDeletePending();
          await this.assetRepository.save(asset, options);
        }
      }
    });
  }
}
