import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { DeleteTransactionUseCaseInput } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.dto';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeleteTransactionUseCase {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute(input: DeleteTransactionUseCaseInput): Promise<void> {
    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    transaction.delete();

    await this.transactionRepository.save(transaction);
  }
}
