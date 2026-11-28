import type { DateOnlyString } from '@/common/utils/date-only';
import { FiscalNoteListSort } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteListItem, FiscalNoteListSummary } from '@/modules/fiscal-notes/domain/repositories';

export interface ListFiscalNotesInput {
  userId: string;
  issuedFrom?: DateOnlyString;
  issuedTo?: DateOnlyString;
  issuerCnpj?: string;
  sourceUf?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  search?: string;
  page?: number;
  limit?: number;
  sort?: FiscalNoteListSort;
}

export interface ListFiscalNotesOutput {
  items: FiscalNoteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  summary: FiscalNoteListSummary;
}
