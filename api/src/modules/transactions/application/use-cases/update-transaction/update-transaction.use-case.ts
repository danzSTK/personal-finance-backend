import { TransactionType } from '@/common/models/enums';
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
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(input: UpdateTransactionUseCaseInput): Promise<UpdateTransactionUseCaseOutput> {
    if (!Object.values(input.patch).some(value => value !== undefined)) {
      throw new TransactionUpdateEmptyError();
    }

    if (input.patch.type !== undefined && !Transaction.supportsAttachmentsForType(input.patch.type)) {
      return this.dataSource.transaction(async manager => {
        const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
          input.transactionId,
          input.userId,
          { manager },
        );

        if (!transaction) {
          throw new TransactionNotFoundError();
        }

        await this.attachmentRepository.deleteInactiveByTransactionId(input.transactionId, { manager });
        const activeAttachmentsCount = await this.attachmentRepository.countActiveByTransactionId(input.transactionId, {
          manager,
        });

        if (activeAttachmentsCount > 0) {
          throw new TransactionTypeDoesNotSupportAttachmentsError();
        }

        return this.applyUpdateAndSave(transaction, input, manager);
      });
    }

    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    return this.applyUpdateAndSave(transaction, input);
  }

  private async applyUpdateAndSave(
    transaction: Transaction,
    input: UpdateTransactionUseCaseInput,
    manager?: EntityManager,
  ): Promise<UpdateTransactionUseCaseOutput> {
    const nextType = input.patch.type ?? transaction.type;
    const nextDestinationAccountId =
      nextType === TransactionType.TRANSFER
        ? (input.patch.destinationAccountId ?? transaction.destinationAccountId)
        : null;

    const references = await this.transactionReferenceValidator.validate({
      userId: input.userId,
      accountId: input.patch.accountId ?? transaction.accountId,
      destinationAccountId: nextDestinationAccountId,
      categoryId: input.patch.categoryId ?? transaction.categoryId,
      type: nextType,
    });

    transaction.applyPatch({
      ...input.patch,
      categoryId: references.category.id,
    });

    return this.transactionRepository.save(transaction, manager ? { manager } : undefined);
  }
}
