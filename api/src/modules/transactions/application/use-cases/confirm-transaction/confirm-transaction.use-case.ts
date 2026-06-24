import { TransactionAlreadyEffectiveError, TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import {
  ConfirmTransactionUseCaseInput,
  ConfirmTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.dto';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { TransactionType } from '@/common/models/enums';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfirmTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(input: ConfirmTransactionUseCaseInput): Promise<ConfirmTransactionUseCaseOutput> {
    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    if (transaction.isEffective) {
      throw new TransactionAlreadyEffectiveError();
    }

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

    return this.transactionRepository.save(transaction);
  }
}
