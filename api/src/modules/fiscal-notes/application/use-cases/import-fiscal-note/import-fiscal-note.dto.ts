import { DateOnlyString } from '@/common/utils/date-only';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import {
  CreateExpenseForFiscalNoteInput,
  TransactionFiscalNotePort,
} from '@/modules/transactions/application/ports/transaction-fiscal-note.port';

export type ImportFiscalNoteInput = Omit<CreateExpenseForFiscalNoteInput, 'amountCents' | 'date'> & {
  input: string;
  amountCents?: number;
  date?: DateOnlyString;
};

export interface ImportFiscalNoteOutput {
  transaction: Awaited<ReturnType<TransactionFiscalNotePort['createExpenseWithinTransaction']>>;
  fiscalNote: FiscalNote;
}
