import {
  CreateTransactionUseCaseInput,
  CreateTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.dto';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { TransactionFactory } from '@/modules/transactions/domain/factories/transaction.factory';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(data: CreateTransactionUseCaseInput): Promise<CreateTransactionUseCaseOutput> {
    const references = await this.transactionReferenceValidator.validate({
      userId: data.userId,
      accountId: data.accountId,
      destinationAccountId: data.destinationAccountId ?? null,
      categoryId: data.categoryId,
      type: data.type,
    });

    const transaction = TransactionFactory.create({
      ...data,
      categoryId: references.category.id,
    });

    return this.transactionRepository.save(transaction);
  }
}
