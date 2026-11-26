import { TransactionType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import {
  AssertTransactionAccessibleInput,
  CreateExpenseForFiscalNoteInput,
  LockAndValidateExpenseForFiscalNoteLinkInput,
  TransactionFiscalNotePort,
} from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionTypeDoesNotSupportFiscalNoteError } from '@/modules/transactions/domain/errors';
import { TransactionFactory } from '@/modules/transactions/domain/factories/transaction.factory';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TransactionFiscalNoteAdapter implements TransactionFiscalNotePort {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountBalanceLockPort: AccountBalanceLockPort,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async createExpenseWithinTransaction(
    input: CreateExpenseForFiscalNoteInput,
    options: Required<IRepositoryOptions>,
  ): Promise<Transaction> {
    await this.accountBalanceLockPort.lockAccountsForBalanceMutation(
      {
        userId: input.userId,
        accountIds: [input.accountId],
      },
      options,
    );

    const references = await this.transactionReferenceValidator.validate(
      {
        userId: input.userId,
        accountId: input.accountId,
        destinationAccountId: null,
        categoryId: input.categoryId,
        type: TransactionType.EXPENSE,
      },
      options,
    );

    const transaction = TransactionFactory.create({
      userId: input.userId,
      accountId: input.accountId,
      destinationAccountId: null,
      categoryId: references.category.id,
      type: TransactionType.EXPENSE,
      status: input.status,
      amountCents: input.amountCents,
      date: input.date,
      description: input.description,
      direction: null,
    });

    const saved = await this.transactionRepository.save(transaction, options);
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
