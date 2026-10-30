import { InvalidAttachmentPositionError } from '@/modules/transactions/domain/errors';
import { randomUUID } from 'node:crypto';

export interface TransactionAttachmentProps {
  id: string;
  transactionId: string;
  assetId: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionAttachmentProps {
  id?: string;
  transactionId: string;
  assetId: string;
  position: number;
}

export class TransactionAttachment {
  private constructor(private readonly props: TransactionAttachmentProps) {}

  get id(): string {
    return this.props.id;
  }

  get transactionId(): string {
    return this.props.transactionId;
  }

  get assetId(): string {
    return this.props.assetId;
  }

  get position(): number {
    return this.props.position;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  changePosition(newPosition: number): void {
    TransactionAttachment.validatePosition(newPosition);
    this.props.position = newPosition;
    this.props.updatedAt = new Date();
  }

  static create(props: CreateTransactionAttachmentProps): TransactionAttachment {
    TransactionAttachment.validatePosition(props.position);
    TransactionAttachment.validateRequiredId(props.transactionId, 'transactionId');
    TransactionAttachment.validateRequiredId(props.assetId, 'assetId');

    const now = new Date();
    return new TransactionAttachment({
      id: props.id ?? randomUUID(),
      transactionId: props.transactionId,
      assetId: props.assetId,
      position: props.position,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: TransactionAttachmentProps): TransactionAttachment {
    return new TransactionAttachment({
      ...props,
      createdAt: new Date(props.createdAt),
      updatedAt: new Date(props.updatedAt),
    });
  }

  private static validatePosition(position: number): void {
    if (!Number.isInteger(position) || position < 0 || position > 2) {
      throw new InvalidAttachmentPositionError('Attachment position must be an integer between 0 and 2.');
    }
  }

  private static validateRequiredId(value: string, field: string): void {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidAttachmentPositionError(`Attachment ${field} must not be empty.`);
    }
  }
}
