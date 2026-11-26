import { TransactionStatus } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface CreateExpenseForFiscalNoteInput {
  userId: string;
  accountId: string;
  categoryId: string;
  amountCents: number;
  date: DateOnlyString;
  description: string | null;
  status: TransactionStatus;
}

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
