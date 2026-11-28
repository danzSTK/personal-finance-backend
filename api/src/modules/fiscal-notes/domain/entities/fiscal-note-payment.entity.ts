import { FISCAL_NOTE_PAYMENT_METHOD_MAX_LENGTH } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { InvalidFiscalNoteError } from '@/modules/fiscal-notes/domain/errors';
import { randomUUID } from 'node:crypto';

export interface FiscalNotePaymentProps {
  fiscalNoteId: string;
  position: number;
  methodLabel: string;
  amountCents: number;
  createdAt: Date;
}

export interface CreateFiscalNotePaymentProps {
  id?: string;
  fiscalNoteId: string;
  position: number;
  methodLabel: string;
  amountCents: number;
  createdAt?: Date;
}

export class FiscalNotePayment {
  private constructor(
    private readonly props: FiscalNotePaymentProps,
    public readonly id: string,
  ) {}

  get fiscalNoteId(): string {
    return this.props.fiscalNoteId;
  }

  get position(): number {
    return this.props.position;
  }

  get methodLabel(): string {
    return this.props.methodLabel;
  }

  get amountCents(): number {
    return this.props.amountCents;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  static create(props: CreateFiscalNotePaymentProps, id?: string): FiscalNotePayment {
    const paymentId = id ?? props.id ?? randomUUID();
    const normalizedProps: FiscalNotePaymentProps = {
      fiscalNoteId: props.fiscalNoteId.trim(),
      position: props.position,
      methodLabel: props.methodLabel.trim(),
      amountCents: props.amountCents,
      createdAt: props.createdAt ? new Date(props.createdAt) : new Date(),
    };

    FiscalNotePayment.validate(normalizedProps, paymentId);

    return new FiscalNotePayment(normalizedProps, paymentId);
  }

  static reconstitute(props: FiscalNotePaymentProps, id: string): FiscalNotePayment {
    return new FiscalNotePayment(
      {
        ...props,
        createdAt: new Date(props.createdAt),
      },
      id,
    );
  }

  private static validate(props: FiscalNotePaymentProps, id: string): void {
    if (!id.trim()) {
      throw new InvalidFiscalNoteError('Fiscal note payment id cannot be empty.');
    }

    if (!props.fiscalNoteId) {
      throw new InvalidFiscalNoteError('Fiscal note payment fiscalNoteId cannot be empty.');
    }

    if (!Number.isSafeInteger(props.position) || props.position < 1) {
      throw new InvalidFiscalNoteError('Fiscal note payment position must be an integer >= 1.');
    }

    if (!props.methodLabel || props.methodLabel.length > FISCAL_NOTE_PAYMENT_METHOD_MAX_LENGTH) {
      throw new InvalidFiscalNoteError(
        `Fiscal note payment methodLabel must be non-empty and at most ${FISCAL_NOTE_PAYMENT_METHOD_MAX_LENGTH} characters.`,
      );
    }

    if (!Number.isSafeInteger(props.amountCents) || props.amountCents < 0) {
      throw new InvalidFiscalNoteError('Fiscal note payment amountCents must be a non-negative safe integer.');
    }

    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      throw new InvalidFiscalNoteError('Fiscal note payment createdAt must be a valid instant.');
    }
  }
}
