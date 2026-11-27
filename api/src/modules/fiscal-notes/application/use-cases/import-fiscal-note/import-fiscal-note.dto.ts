import { DateOnlyString } from '@/common/utils/date-only';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { CreateExpenseForFiscalNoteInput } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

export type ImportFiscalNoteInput = Omit<CreateExpenseForFiscalNoteInput, 'amountCents' | 'date'> & {
  input: string;
  amountCents?: number;
  date?: DateOnlyString;
};

export interface ImportFiscalNoteOutput {
  transaction: Transaction;
  fiscalNote: FiscalNote;
}
