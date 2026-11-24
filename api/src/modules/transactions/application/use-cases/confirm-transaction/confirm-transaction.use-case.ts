import { TransactionType } from '@/common/models/enums';
import { TransactionAlreadyEffectiveError, TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import {
  ConfirmTransactionUseCaseInput,
  ConfirmTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.dto';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionTypeDoesNotSupportAttachmentsError } from '@/modules/transactions/domain/errors';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ConfirmTransactionUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(input: ConfirmTransactionUseCaseInput): Promise<ConfirmTransactionUseCaseOutput> {
    const patch = input.patch ?? {};

    if (patch.type !== undefined && !Transaction.supportsAttachmentsForType(patch.type)) {
      return this.dataSource.transaction(async manager => {
        const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
          input.transactionId,
          input.userId,
          { manager },
        );

        if (!transaction) {
          throw new TransactionNotFoundError();
        }

        if (transaction.isEffective) {
          throw new TransactionAlreadyEffectiveError();
        }

        await this.attachmentRepository.deleteInactiveByTransactionId(input.transactionId, { manager });
        const activeAttachmentsCount = await this.attachmentRepository.countActiveByTransactionId(input.transactionId, {
          manager,
        });

        if (activeAttachmentsCount > 0) {
          throw new TransactionTypeDoesNotSupportAttachmentsError();
        }

        return this.confirmAndSave(transaction, input, manager);
      });
    }

    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    if (transaction.isEffective) {
      throw new TransactionAlreadyEffectiveError();
    }

    return this.confirmAndSave(transaction, input);
  }

  private async confirmAndSave(
    transaction: Transaction,
    input: ConfirmTransactionUseCaseInput,
    manager?: EntityManager,
  ): Promise<ConfirmTransactionUseCaseOutput> {
    const patch = input.patch ?? {};
    const nextType = patch.type ?? transaction.type;
    const nextDestinationAccountId =
      nextType === TransactionType.TRANSFER ? (patch.destinationAccountId ?? transaction.destinationAccountId) : null;

    const references = await this.transactionReferenceValidator.validate({
      userId: input.userId,
      accountId: patch.accountId ?? transaction.accountId,
      destinationAccountId: nextDestinationAccountId,
      categoryId: patch.categoryId ?? transaction.categoryId,
      type: nextType,
    });

    transaction.confirm({
      ...patch,
      categoryId: references.category.id,
    });

    return this.transactionRepository.save(transaction, manager ? { manager } : undefined);
  }
}
