import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface CreateTransactionUseCaseInput {
  userId: string;
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string;
  type: TransactionType;
  status?: TransactionStatus;
  amountCents: number;
  date: DateOnlyString;
  description?: string | null;
  direction?: TransactionDirection | null;
}

export type CreateTransactionUseCaseOutput = Transaction;
