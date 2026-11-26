import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { ParsedFiscalNoteData } from '@/modules/fiscal-notes/application/ports';

export interface PreviewFiscalNoteInput {
  userId: string;
  input: string;
}

export interface SuggestedFiscalNoteTransaction {
  type: typeof TransactionType.EXPENSE;
  status: typeof TransactionStatus.EFFECTIVE;
  amountCents: number;
  date: DateOnlyString;
  description: string;
}

export interface PreviewFiscalNoteOutput {
  alreadyImported: boolean;
  existingTransactionId: string | null;
  existingFiscalNoteId: string | null;
  cacheHit: boolean;
  suggestedTransaction: SuggestedFiscalNoteTransaction;
  fiscalNote: ParsedFiscalNoteData;
}
