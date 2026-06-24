import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface ListTransactionsInput {
  userId: string;
  status?: TransactionStatus;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}

export interface ListTransactionsOutput {
  items: Transaction[];
  total: number;
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
