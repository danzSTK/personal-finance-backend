import { UpdateTransactionPatch } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.dto';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface ConfirmTransactionUseCaseInput {
  userId: string;
  transactionId: string;
  patch?: UpdateTransactionPatch;
}

export type ConfirmTransactionUseCaseOutput = Transaction;
