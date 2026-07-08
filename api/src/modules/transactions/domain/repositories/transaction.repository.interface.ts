import { TransactionListSort } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface ListTransactionsInput {
  userId: string;
  status?: TransactionStatus;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  dateFrom?: DateOnlyString;
  dateTo?: DateOnlyString;
  page: number;
  limit: number;
  sort: TransactionListSort;
}

export interface TransactionTypeSummary {
  pendingCents: number;
  effectiveCents: number;
  totalCents: number;
}

export interface TransactionBalanceSummary {
  pendingDeltaCents: number;
  effectiveDeltaCents: number;
  expectedBalanceCents: number;
}

export interface TransactionGroupedSummary {
  income: TransactionTypeSummary;
  expense: TransactionTypeSummary;
  balance: TransactionBalanceSummary;
}

export type TransactionListSummary = TransactionTypeSummary | TransactionGroupedSummary;

export interface ListTransactionsOutput {
  items: Transaction[];
  total: number;
  summary: TransactionListSummary;
}

export abstract class ITransactionRepository {
  abstract findByIdAndUserId(
    transactionId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<Transaction | null>;
  abstract list(input: ListTransactionsInput, options?: IRepositoryOptions): Promise<ListTransactionsOutput>;
  abstract save(transaction: Transaction, options?: IRepositoryOptions): Promise<Transaction>;
}
