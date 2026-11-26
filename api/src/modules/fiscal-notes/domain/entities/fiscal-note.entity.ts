import {
  FISCAL_NOTE_ACCESS_KEY_REGEX,
  FISCAL_NOTE_CNPJ_REGEX,
  FISCAL_NOTE_ISSUER_NAME_MAX_LENGTH,
  FISCAL_NOTE_NUMBER_MAX_LENGTH,
  FISCAL_NOTE_PARSER_VERSION_MAX_LENGTH,
  FISCAL_NOTE_PROTOCOL_MAX_LENGTH,
  FISCAL_NOTE_SERIES_MAX_LENGTH,
  FISCAL_NOTE_TOTAL_TOLERANCE_CENTS,
  FISCAL_NOTE_UF_REGEX,
  FISCAL_NOTE_XML_VERSION_MAX_LENGTH,
  FISCAL_NOTE_XSLT_VERSION_MAX_LENGTH,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteItem } from '@/modules/fiscal-notes/domain/entities/fiscal-note-item.entity';
import { FiscalNotePayment } from '@/modules/fiscal-notes/domain/entities/fiscal-note-payment.entity';
import { InvalidFiscalNoteError } from '@/modules/fiscal-notes/domain/errors';
import { randomUUID } from 'node:crypto';

export interface FiscalNoteProps {
  userId: string;
  transactionId: string;
  accessKey: string;
  sourceUf: string;
  number: string;
  series: string;
  issuedAt: Date;
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
  items: FiscalNoteItem[];
  payments: FiscalNotePayment[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateFiscalNoteProps {
  id?: string;
  userId: string;
  transactionId: string;
  accessKey: string;
  sourceUf: string;
  number: string;
  series: string;
  issuedAt: Date;
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
  items: FiscalNoteItem[];
  payments: FiscalNotePayment[];
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class FiscalNote {
  private constructor(
    private readonly props: FiscalNoteProps,
    public readonly id: string,
  ) {}

  get userId(): string {
    return this.props.userId;
  }

  get transactionId(): string {
    return this.props.transactionId;
  }

  get accessKey(): string {
    return this.props.accessKey;
  }

  get sourceUf(): string {
    return this.props.sourceUf;
  }

  get number(): string {
    return this.props.number;
  }

  get series(): string {
    return this.props.series;
  }

  get issuedAt(): Date {
    return new Date(this.props.issuedAt);
  }

  get protocol(): string | null {
    return this.props.protocol;
  }

  get issuerName(): string {
    return this.props.issuerName;
  }

  get issuerCnpj(): string {
    return this.props.issuerCnpj;
  }

  get issuerAddress(): string | null {
    return this.props.issuerAddress;
  }

  get grossAmountCents(): number {
    return this.props.grossAmountCents;
  }

  get discountAmountCents(): number {
    return this.props.discountAmountCents;
  }

  get payableAmountCents(): number {
    return this.props.payableAmountCents;
  }

  get taxAmountCents(): number {
    return this.props.taxAmountCents;
  }

  get changeAmountCents(): number | null {
    return this.props.changeAmountCents;
  }

  get xmlVersion(): string | null {
    return this.props.xmlVersion;
  }

  get xsltVersion(): string | null {
    return this.props.xsltVersion;
  }

  get parserVersion(): string {
    return this.props.parserVersion;
  }

  get items(): ReadonlyArray<FiscalNoteItem> {
    return [...this.props.items];
  }

  get payments(): ReadonlyArray<FiscalNotePayment> {
    return [...this.props.payments];
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt ? new Date(this.props.deletedAt) : null;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  softDelete(now = new Date()): void {
    if (this.props.deletedAt !== null) {
      return;
    }

    const deleteTimestamp = new Date(now);
    this.props.deletedAt = deleteTimestamp;
    this.props.updatedAt = deleteTimestamp;
  }

  static create(props: CreateFiscalNoteProps, id?: string): FiscalNote {
    const noteId = id ?? props.id ?? randomUUID();
    const now = new Date();
    const normalizedProps: FiscalNoteProps = {
      userId: props.userId.trim(),
      transactionId: props.transactionId.trim(),
      accessKey: props.accessKey.trim(),
      sourceUf: props.sourceUf.trim(),
      number: props.number.trim(),
      series: props.series.trim(),
      issuedAt: new Date(props.issuedAt),
      protocol: FiscalNote.normalizeOptionalString(props.protocol),
      issuerName: props.issuerName.trim(),
      issuerCnpj: props.issuerCnpj.trim(),
      issuerAddress: FiscalNote.normalizeOptionalString(props.issuerAddress),
      grossAmountCents: props.grossAmountCents,
      discountAmountCents: props.discountAmountCents,
      payableAmountCents: props.payableAmountCents,
      taxAmountCents: props.taxAmountCents,
      changeAmountCents: props.changeAmountCents,
      xmlVersion: FiscalNote.normalizeOptionalString(props.xmlVersion),
      xsltVersion: FiscalNote.normalizeOptionalString(props.xsltVersion),
      parserVersion: props.parserVersion.trim(),
      items: [...props.items],
      payments: [...props.payments],
      createdAt: props.createdAt ? new Date(props.createdAt) : now,
      updatedAt: props.updatedAt ? new Date(props.updatedAt) : now,
      deletedAt: props.deletedAt ? new Date(props.deletedAt) : null,
    };

    FiscalNote.validate(normalizedProps, noteId);

    return new FiscalNote(normalizedProps, noteId);
  }

  static reconstitute(props: FiscalNoteProps, id: string): FiscalNote {
    return new FiscalNote(
      {
        ...props,
        issuedAt: new Date(props.issuedAt),
        items: [...props.items],
        payments: [...props.payments],
        createdAt: new Date(props.createdAt),
        updatedAt: new Date(props.updatedAt),
        deletedAt: props.deletedAt ? new Date(props.deletedAt) : null,
      },
      id,
    );
  }

  private static validate(props: FiscalNoteProps, id: string): void {
    if (!id.trim()) {
      throw new InvalidFiscalNoteError('Fiscal note id cannot be empty.');
    }

    if (!props.userId) {
      throw new InvalidFiscalNoteError('Fiscal note userId cannot be empty.');
    }

    if (!props.transactionId) {
      throw new InvalidFiscalNoteError('Fiscal note transactionId cannot be empty.');
    }

    if (!FISCAL_NOTE_ACCESS_KEY_REGEX.test(props.accessKey)) {
      throw new InvalidFiscalNoteError('Fiscal note accessKey must contain exactly 44 numeric digits.');
    }

    if (!FISCAL_NOTE_UF_REGEX.test(props.sourceUf)) {
      throw new InvalidFiscalNoteError('Fiscal note sourceUf must contain exactly 2 numeric digits.');
    }

    if (!props.number || props.number.length > FISCAL_NOTE_NUMBER_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note number must be non-empty and at most ${FISCAL_NOTE_NUMBER_MAX_LENGTH} characters.`,
      );
    }

    if (!props.series || props.series.length > FISCAL_NOTE_SERIES_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note series must be non-empty and at most ${FISCAL_NOTE_SERIES_MAX_LENGTH} characters.`,
      );
    }

    FiscalNote.validateInstant(props.issuedAt, 'issuedAt');

    if (props.protocol !== null && props.protocol.length > FISCAL_NOTE_PROTOCOL_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note protocol must be at most ${FISCAL_NOTE_PROTOCOL_MAX_LENGTH} characters.`,
      );
    }

    if (!props.issuerName || props.issuerName.length > FISCAL_NOTE_ISSUER_NAME_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note issuerName must be non-empty and at most ${FISCAL_NOTE_ISSUER_NAME_MAX_LENGTH} characters.`,
      );
    }

    if (!FISCAL_NOTE_CNPJ_REGEX.test(props.issuerCnpj)) {
      throw new InvalidFiscalNoteError('Fiscal note issuerCnpj must contain exactly 14 numeric digits.');
    }

    if (props.xmlVersion !== null && props.xmlVersion.length > FISCAL_NOTE_XML_VERSION_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note xmlVersion must be at most ${FISCAL_NOTE_XML_VERSION_MAX_LENGTH} characters.`,
      );
    }

    if (props.xsltVersion !== null && props.xsltVersion.length > FISCAL_NOTE_XSLT_VERSION_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note xsltVersion must be at most ${FISCAL_NOTE_XSLT_VERSION_MAX_LENGTH} characters.`,
      );
    }

    if (!props.parserVersion || props.parserVersion.length > FISCAL_NOTE_PARSER_VERSION_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note parserVersion must be non-empty and at most ${FISCAL_NOTE_PARSER_VERSION_MAX_LENGTH} characters.`,
      );
    }

    FiscalNote.validateNonNegativeSafeCents(props.grossAmountCents, 'grossAmountCents');
    FiscalNote.validateNonNegativeSafeCents(props.discountAmountCents, 'discountAmountCents');
    FiscalNote.validateNonNegativeSafeCents(props.payableAmountCents, 'payableAmountCents');
    FiscalNote.validateNonNegativeSafeCents(props.taxAmountCents, 'taxAmountCents');

    if (props.changeAmountCents !== null) {
      FiscalNote.validateNonNegativeSafeCents(props.changeAmountCents, 'changeAmountCents');
    }

    const expectedPayableDiff = Math.abs(props.grossAmountCents - props.discountAmountCents - props.payableAmountCents);
    if (expectedPayableDiff > FISCAL_NOTE_TOTAL_TOLERANCE_CENTS) {
      throw new InvalidFiscalNoteError(
        `Fiscal note amounts are inconsistent (difference exceeds ${FISCAL_NOTE_TOTAL_TOLERANCE_CENTS} cent).`,
      );
    }

    if (props.items.length < 1) {
      throw new InvalidFiscalNoteError('Fiscal note must contain at least one item.');
    }

    const itemPositions = new Set<number>();
    for (const item of props.items) {
      if (itemPositions.has(item.position)) {
        throw new InvalidFiscalNoteError(`Duplicate fiscal note item position ${item.position}.`);
      }
      itemPositions.add(item.position);
    }

    const paymentPositions = new Set<number>();
    for (const payment of props.payments) {
      if (paymentPositions.has(payment.position)) {
        throw new InvalidFiscalNoteError(`Duplicate fiscal note payment position ${payment.position}.`);
      }
      paymentPositions.add(payment.position);
    }

    FiscalNote.validateInstant(props.createdAt, 'createdAt');
    FiscalNote.validateInstant(props.updatedAt, 'updatedAt');
    if (props.deletedAt !== null) {
      FiscalNote.validateInstant(props.deletedAt, 'deletedAt');
    }
  }

  private static validateNonNegativeSafeCents(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidFiscalNoteError(`Fiscal note ${field} must be a non-negative safe integer.`);
    }
  }

  private static validateInstant(date: Date, field: string): void {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new InvalidFiscalNoteError(`Fiscal note ${field} must be a valid instant.`);
    }
  }

  private static normalizeOptionalString(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
