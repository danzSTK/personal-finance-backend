import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface ListTransactionsUseCaseInput {
  userId: string;
  status?: TransactionStatus;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface ListTransactionsUseCaseOutput {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
