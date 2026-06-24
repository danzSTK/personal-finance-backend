import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface GetTransactionUseCaseInput {
  userId: string;
  transactionId: string;
}

export type GetTransactionUseCaseOutput = Transaction;
