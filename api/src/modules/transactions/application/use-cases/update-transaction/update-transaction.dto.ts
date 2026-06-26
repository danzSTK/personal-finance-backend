import { TransactionDirection, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface UpdateTransactionPatch {
  accountId?: string;
  destinationAccountId?: string | null;
  categoryId?: string;
  type?: TransactionType;
  amountCents?: number;
  date?: DateOnlyString;
  description?: string | null;
  direction?: TransactionDirection | null;
}

export interface UpdateTransactionUseCaseInput {
  userId: string;
  transactionId: string;
  patch: UpdateTransactionPatch;
}

export type UpdateTransactionUseCaseOutput = Transaction;
