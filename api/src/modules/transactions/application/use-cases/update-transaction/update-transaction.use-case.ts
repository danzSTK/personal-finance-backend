import { TransactionUpdateEmptyError, TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import {
  UpdateTransactionUseCaseInput,
  UpdateTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.dto';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { TransactionType } from '@/common/models/enums';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(input: UpdateTransactionUseCaseInput): Promise<UpdateTransactionUseCaseOutput> {
    if (!Object.values(input.patch).some(value => value !== undefined)) {
      throw new TransactionUpdateEmptyError();
    }

    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

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

    return this.transactionRepository.save(transaction);
  }
}
