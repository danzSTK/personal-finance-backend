import { TransactionType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import {
  AssertTransactionAccessibleInput,
  CreateExpenseForFiscalNoteInput,
  LockAndValidateExpenseForFiscalNoteLinkInput,
  TransactionFiscalNotePort,
} from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionTypeDoesNotSupportFiscalNoteError } from '@/modules/transactions/domain/errors';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TransactionFiscalNoteAdapter implements TransactionFiscalNotePort {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly createTransactionUseCase: CreateTransactionUseCase,
  ) {}

  async createExpenseWithinTransaction(
    input: CreateExpenseForFiscalNoteInput,
    options: Required<IRepositoryOptions>,
  ): Promise<Transaction> {
    const saved = await this.createTransactionUseCase.execute(
      {
        ...input,
        type: TransactionType.EXPENSE,
        destinationAccountId: null,
        direction: null,
      },
      options,
    );
    saved.setHasFiscalNote(true);

    return saved;
  }

  async lockAndValidateExpenseForFiscalNoteLink(
    input: LockAndValidateExpenseForFiscalNoteLinkInput,
    options: Required<IRepositoryOptions>,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
      input.transactionId,
      input.userId,
      options,
    );

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    if (!transaction.supportsFiscalNote()) {
      throw new TransactionTypeDoesNotSupportFiscalNoteError();
    }

    return transaction;
  }

  async assertTransactionAccessible(
    input: AssertTransactionAccessibleInput,
    options?: IRepositoryOptions,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId, options);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    return transaction;
  }
}
