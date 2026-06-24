import { TRANSACTION_AMOUNT_CENTS_MAX, TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { applyIfDefined } from '@/common/utils/utils';
import {
  InvalidTransactionError,
  TransactionCannotDeleteTransferError,
  TransactionInvalidStateTransitionError,
} from '@/modules/transactions/domain/errors';

export interface TransactionProps {
  userId: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string;
  type: TransactionType;
  status: TransactionStatus;
  amountCents: number;
  date: Date;
  effectiveAt: Date | null;
  description: string | null;
  direction: TransactionDirection | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateTransactionProps {
  accountId?: string;
  destinationAccountId?: string | null;
  categoryId?: string;
  type?: TransactionType;
  amountCents?: number;
  date?: Date;
  description?: string | null;
  direction?: TransactionDirection | null;
}

export class Transaction {
  private constructor(
    private readonly props: TransactionProps,
    public readonly id: string,
  ) {}

  get userId(): string {
    return this.props.userId;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get destinationAccountId(): string | null {
    return this.props.destinationAccountId;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get type(): TransactionType {
    return this.props.type;
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  get amountCents(): number {
    return this.props.amountCents;
  }

  get date(): Date {
    return new Date(this.props.date);
  }

  get effectiveAt(): Date | null {
    return this.props.effectiveAt ? new Date(this.props.effectiveAt) : null;
  }

  get description(): string | null {
    return this.props.description;
  }

  get direction(): TransactionDirection | null {
    return this.props.direction;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt ? new Date(this.props.deletedAt) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  get isPending(): boolean {
    return this.props.status === TransactionStatus.PENDING;
  }

  get isEffective(): boolean {
    return this.props.status === TransactionStatus.EFFECTIVE;
  }

  applyPatch(patch: UpdateTransactionProps): void {
    const nextType = patch.type ?? this.props.type;
    const nextDestinationAccountId =
      nextType === TransactionType.TRANSFER ? (patch.destinationAccountId ?? this.props.destinationAccountId) : null;
    const nextDirection = nextType === TransactionType.ADJUSTMENT ? (patch.direction ?? this.props.direction) : null;
    const nextDescription = patch.description !== undefined ? patch.description : this.props.description;

    const nextProps: TransactionProps = {
      ...this.props,
      accountId: patch.accountId ?? this.props.accountId,
      destinationAccountId: nextDestinationAccountId,
      categoryId: patch.categoryId ?? this.props.categoryId,
      type: nextType,
      amountCents: patch.amountCents ?? this.props.amountCents,
      date: patch.date ?? this.props.date,
      description: Transaction.normalizeDescription(nextDescription),
      direction: nextDirection,
      updatedAt: new Date(),
    };

    Transaction.validate(nextProps);

    applyIfDefined(patch.accountId, value => (this.props.accountId = value));
    this.props.destinationAccountId = nextDestinationAccountId;
    applyIfDefined(patch.categoryId, value => (this.props.categoryId = value));
    this.props.type = nextType;
    applyIfDefined(patch.amountCents, value => (this.props.amountCents = value));
    applyIfDefined(patch.date, value => (this.props.date = value));
    this.props.description = nextProps.description;
    this.props.direction = nextDirection;
    this.props.updatedAt = nextProps.updatedAt;
  }

  confirm(patch: UpdateTransactionProps = {}): void {
    if (this.props.status === TransactionStatus.EFFECTIVE) {
      throw new TransactionInvalidStateTransitionError('Only pending transactions can be confirmed.');
    }

    this.applyPatch(patch);
    this.props.status = TransactionStatus.EFFECTIVE;
    this.props.effectiveAt = new Date();
    this.props.updatedAt = new Date();
    Transaction.validate(this.props);
  }

  delete(): void {
    if (this.props.type === TransactionType.TRANSFER) {
      throw new TransactionCannotDeleteTransferError();
    }

    if (this.props.deletedAt) {
      return;
    }

    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  static create(props: TransactionProps, id: string): Transaction {
    const normalizedProps = {
      ...props,
      description: Transaction.normalizeDescription(props.description),
    };

    Transaction.validate(normalizedProps);

    return new Transaction(normalizedProps, id);
  }

  static reconstitute(props: TransactionProps, id: string): Transaction {
    return new Transaction(props, id);
  }

  private static validate(props: TransactionProps): void {
    Transaction.validateAmount(props.amountCents);
    Transaction.validateDate(props.date, 'date');
    Transaction.validateEffectiveAt(props);
    Transaction.validateDestinationAccount(props);
    Transaction.validateDirection(props);
    Transaction.validateDescription(props);
  }

  private static validateAmount(amountCents: number): void {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > TRANSACTION_AMOUNT_CENTS_MAX) {
      throw new InvalidTransactionError('Transaction amountCents must be a positive safe integer.');
    }
  }

  private static validateDate(date: Date, field: string): void {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new InvalidTransactionError(`Transaction ${field} must be a valid date.`);
    }
  }

  private static validateEffectiveAt(props: TransactionProps): void {
    if (props.status === TransactionStatus.PENDING && props.effectiveAt !== null) {
      throw new InvalidTransactionError('Pending transactions cannot have effectiveAt.');
    }

    if (props.status === TransactionStatus.EFFECTIVE && props.effectiveAt === null) {
      throw new InvalidTransactionError('Effective transactions must have effectiveAt.');
    }

    if (props.effectiveAt !== null) {
      Transaction.validateDate(props.effectiveAt, 'effectiveAt');
    }
  }

  private static validateDestinationAccount(props: TransactionProps): void {
    if (props.type === TransactionType.TRANSFER) {
      if (!props.destinationAccountId) {
        throw new InvalidTransactionError('Transfer transactions must have destinationAccountId.');
      }

      if (props.destinationAccountId === props.accountId) {
        throw new InvalidTransactionError('Transfer origin and destination accounts must be different.');
      }

      return;
    }

    if (props.destinationAccountId !== null) {
      throw new InvalidTransactionError('Only transfer transactions can have destinationAccountId.');
    }
  }

  private static validateDirection(props: TransactionProps): void {
    if (props.type === TransactionType.ADJUSTMENT) {
      if (!props.direction) {
        throw new InvalidTransactionError('Adjustment transactions must have direction.');
      }

      return;
    }

    if (props.direction !== null) {
      throw new InvalidTransactionError('Only adjustment transactions can have direction.');
    }
  }

  private static validateDescription(props: TransactionProps): void {
    if (props.description !== null && props.description.length > TRANSACTION_DESCRIPTION_MAX_LENGTH) {
      throw new InvalidTransactionError(
        `Transaction description must be at most ${TRANSACTION_DESCRIPTION_MAX_LENGTH} characters.`,
      );
    }

    if (props.type === TransactionType.ADJUSTMENT && (!props.description || props.description.trim() === '')) {
      throw new InvalidTransactionError('Adjustment transactions must have description.');
    }
  }

  private static normalizeDescription(description: string | null): string | null {
    if (description === null) {
      return null;
    }

    const trimmed = description.trim();

    return trimmed.length > 0 ? trimmed : null;
  }
}
