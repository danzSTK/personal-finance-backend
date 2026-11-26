import {
  FISCAL_NOTE_ITEM_DESCRIPTION_MAX_LENGTH,
  FISCAL_NOTE_ITEM_STORE_CODE_MAX_LENGTH,
  FISCAL_NOTE_ITEM_UNIT_MAX_LENGTH,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { InvalidFiscalNoteError } from '@/modules/fiscal-notes/domain/errors';
import { randomUUID } from 'node:crypto';

export interface FiscalNoteItemProps {
  fiscalNoteId: string;
  position: number;
  rawDescription: string;
  storeCode: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPriceCents: number;
  createdAt: Date;
}

export interface CreateFiscalNoteItemProps {
  id?: string;
  fiscalNoteId: string;
  position: number;
  rawDescription: string;
  storeCode: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPriceCents: number;
  createdAt?: Date;
}

export class FiscalNoteItem {
  private constructor(
    private readonly props: FiscalNoteItemProps,
    public readonly id: string,
  ) {}

  get fiscalNoteId(): string {
    return this.props.fiscalNoteId;
  }

  get position(): number {
    return this.props.position;
  }

  get rawDescription(): string {
    return this.props.rawDescription;
  }

  get storeCode(): string | null {
    return this.props.storeCode;
  }

  get unit(): string {
    return this.props.unit;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): number {
    return this.props.unitPrice;
  }

  get totalPriceCents(): number {
    return this.props.totalPriceCents;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  static create(props: CreateFiscalNoteItemProps, id?: string): FiscalNoteItem {
    const itemId = id ?? props.id ?? randomUUID();
    const normalizedStoreCode = FiscalNoteItem.normalizeOptionalString(props.storeCode);
    const normalizedProps: FiscalNoteItemProps = {
      fiscalNoteId: props.fiscalNoteId.trim(),
      position: props.position,
      rawDescription: props.rawDescription.trim(),
      storeCode: normalizedStoreCode,
      unit: props.unit.trim(),
      quantity: props.quantity,
      unitPrice: props.unitPrice,
      totalPriceCents: props.totalPriceCents,
      createdAt: props.createdAt ? new Date(props.createdAt) : new Date(),
    };

    FiscalNoteItem.validate(normalizedProps, itemId);

    return new FiscalNoteItem(normalizedProps, itemId);
  }

  static reconstitute(props: FiscalNoteItemProps, id: string): FiscalNoteItem {
    return new FiscalNoteItem(
      {
        ...props,
        createdAt: new Date(props.createdAt),
      },
      id,
    );
  }

  private static validate(props: FiscalNoteItemProps, id: string): void {
    if (!id.trim()) {
      throw new InvalidFiscalNoteError('Fiscal note item id cannot be empty.');
    }

    if (!props.fiscalNoteId) {
      throw new InvalidFiscalNoteError('Fiscal note item fiscalNoteId cannot be empty.');
    }

    if (!Number.isSafeInteger(props.position) || props.position < 1) {
      throw new InvalidFiscalNoteError('Fiscal note item position must be an integer >= 1.');
    }

    if (!props.rawDescription || props.rawDescription.length > FISCAL_NOTE_ITEM_DESCRIPTION_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note item description must be non-empty and at most ${FISCAL_NOTE_ITEM_DESCRIPTION_MAX_LENGTH} characters.`,
      );
    }

    if (props.storeCode !== null && props.storeCode.length > FISCAL_NOTE_ITEM_STORE_CODE_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note item storeCode must be at most ${FISCAL_NOTE_ITEM_STORE_CODE_MAX_LENGTH} characters.`,
      );
    }

    if (!props.unit || props.unit.length > FISCAL_NOTE_ITEM_UNIT_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note item unit must be non-empty and at most ${FISCAL_NOTE_ITEM_UNIT_MAX_LENGTH} characters.`,
      );
    }

    if (typeof props.quantity !== 'number' || !Number.isFinite(props.quantity) || props.quantity <= 0) {
      throw new InvalidFiscalNoteError('Fiscal note item quantity must be a finite number > 0.');
    }

    if (typeof props.unitPrice !== 'number' || !Number.isFinite(props.unitPrice) || props.unitPrice < 0) {
      throw new InvalidFiscalNoteError('Fiscal note item unitPrice must be a finite number >= 0.');
    }

    if (!Number.isSafeInteger(props.totalPriceCents) || props.totalPriceCents < 0) {
      throw new InvalidFiscalNoteError('Fiscal note item totalPriceCents must be a non-negative safe integer.');
    }

    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      throw new InvalidFiscalNoteError('Fiscal note item createdAt must be a valid instant.');
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
