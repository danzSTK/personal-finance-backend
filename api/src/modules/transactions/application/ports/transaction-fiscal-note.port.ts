import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { CreateTransactionUseCaseInput } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.dto';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export type CreateExpenseForFiscalNoteInput = Omit<
  CreateTransactionUseCaseInput,
  'type' | 'destinationAccountId' | 'direction' | 'categoryId'
> & {
  categoryId: string;
};

export interface LockAndValidateExpenseForFiscalNoteLinkInput {
  userId: string;
  transactionId: string;
}

export interface AssertTransactionAccessibleInput {
  userId: string;
  transactionId: string;
}

export abstract class TransactionFiscalNotePort {
  abstract createExpenseWithinTransaction(
    input: CreateExpenseForFiscalNoteInput,
    options: Required<IRepositoryOptions>,
  ): Promise<Transaction>;

  abstract lockAndValidateExpenseForFiscalNoteLink(
    input: LockAndValidateExpenseForFiscalNoteLinkInput,
    options: Required<IRepositoryOptions>,
  ): Promise<Transaction>;

  abstract assertTransactionAccessible(
    input: AssertTransactionAccessibleInput,
    options?: IRepositoryOptions,
  ): Promise<Transaction>;
}
