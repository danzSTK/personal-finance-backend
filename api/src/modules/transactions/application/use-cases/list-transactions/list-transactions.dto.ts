import { TransactionListSort } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface ListTransactionsUseCaseInput {
  userId: string;
  status?: TransactionStatus;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  dateFrom?: DateOnlyString;
  dateTo?: DateOnlyString;
  page?: number;
  limit?: number;
  sort?: TransactionListSort;
}

export interface ListTransactionsTypeSummary {
  pendingCents: number;
  effectiveCents: number;
  totalCents: number;
}

export interface ListTransactionsBalanceSummary {
  pendingDeltaCents: number;
  effectiveDeltaCents: number;
  expectedBalanceCents: number;
}

export interface ListTransactionsGroupedSummary {
  currentBalanceCents: number;
  income: ListTransactionsTypeSummary;
  expense: ListTransactionsTypeSummary;
  balance: ListTransactionsBalanceSummary;
}

export type ListTransactionsSummary = ListTransactionsTypeSummary | ListTransactionsGroupedSummary;

export interface ListTransactionsUseCaseOutput {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  summary: ListTransactionsSummary;
}
