import { DateOnlyString } from '@/common/utils/date-only';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';

export interface ParsedFiscalNoteItemData {
  position: number;
  rawDescription: string;
  storeCode: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPriceCents: number;
}

export interface ParsedFiscalNotePaymentData {
  position: number;
  methodLabel: string;
  amountCents: number;
}

export interface ParsedFiscalNoteData {
  accessKey: string;
  sourceUf: string;
  number: string;
  series: string;
  issuedAt: Date;
  issuedDate: DateOnlyString;
  protocol: string | null;
  issuerName: string;
  issuerCnpj: string;
  issuerAddress: string | null;
  grossAmountCents: number;
  discountAmountCents: number;
  payableAmountCents: number;
  taxAmountCents: number;
  changeAmountCents: number | null;
  xmlVersion: string | null;
  xsltVersion: string | null;
  parserVersion: string;
  items: ParsedFiscalNoteItemData[];
  payments: ParsedFiscalNotePaymentData[];
}

export abstract class IFiscalNoteProvider {
  abstract readonly uf: string;

  abstract fetchAndParse(input: FiscalNoteInput): Promise<ParsedFiscalNoteData>;
}
