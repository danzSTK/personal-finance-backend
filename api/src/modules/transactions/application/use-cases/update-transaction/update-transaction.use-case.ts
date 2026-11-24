import { TransactionType } from '@/common/models/enums';
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { TransactionNotFoundError, TransactionUpdateEmptyError } from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import {
  UpdateTransactionUseCaseInput,
  UpdateTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.dto';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionTypeDoesNotSupportAttachmentsError } from '@/modules/transactions/domain/errors';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly accountBalanceLockPort: AccountBalanceLockPort,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(input: UpdateTransactionUseCaseInput): Promise<UpdateTransactionUseCaseOutput> {
    if (!Object.values(input.patch).some(value => value !== undefined)) {
      throw new TransactionUpdateEmptyError();
    }

    return this.dataSource.transaction(async manager => {
      const options = { manager };
      const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
        input.transactionId,
        input.userId,
        options,
      );

      if (!transaction) {
        throw new TransactionNotFoundError();
      }

      if (input.patch.type !== undefined && !Transaction.supportsAttachmentsForType(input.patch.type)) {
        await this.attachmentRepository.deleteInactiveByTransactionId(input.transactionId, options);
        const activeAttachmentsCount = await this.attachmentRepository.countActiveByTransactionId(
          input.transactionId,
          options,
        );

        if (activeAttachmentsCount > 0) {
          throw new TransactionTypeDoesNotSupportAttachmentsError();
        }
      }

      const nextType = input.patch.type ?? transaction.type;
      const nextAccountId = input.patch.accountId ?? transaction.accountId;
      const nextDestinationAccountId =
        nextType === TransactionType.TRANSFER
          ? (input.patch.destinationAccountId ?? transaction.destinationAccountId)
          : null;

      const accountIdsToLock = [
        transaction.accountId,
        transaction.destinationAccountId,
        nextAccountId,
        nextDestinationAccountId,
      ].filter((id): id is string => id !== null);

      await this.accountBalanceLockPort.lockAccountsForBalanceMutation(
        {
          userId: input.userId,
          accountIds: accountIdsToLock,
        },
        options,
      );

      const references = await this.transactionReferenceValidator.validate(
        {
          userId: input.userId,
          accountId: nextAccountId,
          destinationAccountId: nextDestinationAccountId,
          categoryId: input.patch.categoryId ?? transaction.categoryId,
          type: nextType,
        },
        options,
      );

      transaction.applyPatch({
        ...input.patch,
        categoryId: references.category.id,
      });

      return this.transactionRepository.save(transaction, options);
    });
  }
}
