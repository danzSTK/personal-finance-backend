import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface CreateBalanceAdjustmentUseCaseInput {
  userId: string;
  accountId: string;
  targetBalanceCents: number;
  date: DateOnlyString;
  description?: string | null;
}

export type CreateBalanceAdjustmentUseCaseOutput = Transaction;
