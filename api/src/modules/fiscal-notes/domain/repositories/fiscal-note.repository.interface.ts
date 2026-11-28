import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import type { DateOnlyString } from '@/common/utils/date-only';
import { FiscalNoteListSort } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';

export interface FiscalNoteListItem {
  id: string;
  transactionId: string;
  accessKey: string;
  sourceUf: string;
  number: string;
  series: string;
  issuedAt: Date;
  issuerName: string;
  issuerCnpj: string;
  grossAmountCents: number;
  discountAmountCents: number;
  payableAmountCents: number;
  taxAmountCents: number;
  itemsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FiscalNoteListSummary {
  totalNotes: number;
  totalGrossAmountCents: number;
  totalDiscountAmountCents: number;
  totalPayableAmountCents: number;
  totalTaxAmountCents: number;
}

export interface ListFiscalNotesRepositoryInput {
  userId: string;
  issuedFrom?: DateOnlyString;
  issuedTo?: DateOnlyString;
  issuerCnpj?: string;
  sourceUf?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  search?: string;
  page: number;
  limit: number;
  sort: FiscalNoteListSort;
}

export interface ListFiscalNotesRepositoryOutput {
  items: FiscalNoteListItem[];
  total: number;
  summary: FiscalNoteListSummary;
}

export abstract class IFiscalNoteRepository {
  abstract findActiveByIdAndUserId(
    id: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null>;

  abstract list(
    input: ListFiscalNotesRepositoryInput,
    options?: IRepositoryOptions,
  ): Promise<ListFiscalNotesRepositoryOutput>;

  abstract findActiveByUserIdAndAccessKey(
    userId: string,
    accessKey: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null>;

  abstract findActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<FiscalNote | null>;

  abstract findActiveByTransactionIdAndUserId(
    transactionId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null>;

  abstract hasActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<boolean>;

  abstract findActiveTransactionIds(transactionIds: string[], options?: IRepositoryOptions): Promise<Set<string>>;

  abstract save(fiscalNote: FiscalNote, options?: IRepositoryOptions): Promise<FiscalNote>;

  abstract softDeleteByTransactionId(
    transactionId: string,
    userId: string,
    options: Required<IRepositoryOptions>,
  ): Promise<boolean>;
}
