import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { randomUUID } from 'node:crypto';

export interface CreateTransactionInput {
  userId: string;
  accountId: string;
  destinationAccountId?: string | null;
  categoryId: string;
  type: TransactionType;
  status?: TransactionStatus;
  amountCents: number;
  date: DateOnlyString;
  description?: string | null;
  direction?: TransactionDirection | null;
}

export class TransactionFactory {
  static create(input: CreateTransactionInput): Transaction {
    const now = new Date();
    const status = input.status ?? TransactionStatus.EFFECTIVE;

    return Transaction.create(
      {
        userId: input.userId,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId ?? null,
        categoryId: input.categoryId,
        type: input.type,
        status,
        amountCents: input.amountCents,
        date: input.date,
        effectiveAt: status === TransactionStatus.EFFECTIVE ? now : null,
        description: input.description ?? null,
        direction: input.direction ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      randomUUID(),
    );
  }
}
