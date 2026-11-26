import { TransactionStatus } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export interface ImportFiscalNoteInput {
  userId: string;
  input: string;
  accountId: string;
  categoryId: string;
  amountCents?: number;
  date?: DateOnlyString;
  description?: string | null;
  status?: TransactionStatus;
}

export interface ImportFiscalNoteOutput {
  transaction: Transaction;
  fiscalNote: FiscalNote;
}
