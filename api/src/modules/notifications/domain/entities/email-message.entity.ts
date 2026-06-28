import {
  EmailMessageLimits,
  EmailMessageStatus,
  EmailMessageType,
  EmailProviderKey,
  EmailTemplateKey,
} from '@/modules/notifications/domain/constants/email-message.constants';
import { InvalidEmailMessageError } from '@/modules/notifications/domain/errors';

export interface EmailMessageProps {
  type: EmailMessageType;
  recipientEmail: string;
  recipientName: string | null;
  provider: EmailProviderKey;
  templateKey: EmailTemplateKey;
  providerTemplateId: string;
  templateParams: Record<string, unknown>;
  idempotencyKey: string;
  status: EmailMessageStatus;
  providerMessageId: string | null;
  attemptsCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  processingAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailMessage {
  private constructor(
    private readonly props: EmailMessageProps,
    public readonly id: string,
  ) {}

  get type(): EmailMessageType {
    return this.props.type;
  }

  get recipientEmail(): string {
    return this.props.recipientEmail;
  }

  get recipientName(): string | null {
    return this.props.recipientName;
  }

  get provider(): EmailProviderKey {
    return this.props.provider;
  }

  get templateKey(): EmailTemplateKey {
    return this.props.templateKey;
  }

  get providerTemplateId(): string {
    return this.props.providerTemplateId;
  }

  get templateParams(): Readonly<Record<string, unknown>> {
    return this.props.templateParams;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get status(): EmailMessageStatus {
    return this.props.status;
  }

  get providerMessageId(): string | null {
    return this.props.providerMessageId;
  }

  get attemptsCount(): number {
    return this.props.attemptsCount;
  }

  get lastErrorCode(): string | null {
    return this.props.lastErrorCode;
  }

  get lastErrorMessage(): string | null {
    return this.props.lastErrorMessage;
  }

  get processingAt(): Date | null {
    return this.props.processingAt;
  }

  get sentAt(): Date | null {
    return this.props.sentAt;
  }

  get failedAt(): Date | null {
    return this.props.failedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isTerminal(): boolean {
    return (
      this.props.status === EmailMessageStatus.SENT ||
      this.props.status === EmailMessageStatus.FAILED_PERMANENT ||
      this.props.status === EmailMessageStatus.CANCELED
    );
  }

  get canBeEnqueued(): boolean {
    return (
      this.props.status === EmailMessageStatus.PENDING || this.props.status === EmailMessageStatus.FAILED_RETRYABLE
    );
  }

  get canBeProcessed(): boolean {
    return (
      this.props.status === EmailMessageStatus.PENDING ||
      this.props.status === EmailMessageStatus.PROCESSING ||
      this.props.status === EmailMessageStatus.FAILED_RETRYABLE
    );
  }

  markProcessing(now = new Date()): void {
    if (!this.canBeProcessed) {
      return;
    }

    this.props.status = EmailMessageStatus.PROCESSING;
    this.props.processingAt = now;
    this.props.updatedAt = now;
  }

  markSent(providerMessageId: string | null, now = new Date()): void {
    if (this.props.status === EmailMessageStatus.SENT) {
      return;
    }

    if (this.isTerminal) {
      throw new InvalidEmailMessageError(`Cannot mark ${this.props.status} email message as sent.`);
    }

    this.props.status = EmailMessageStatus.SENT;
    this.props.providerMessageId = EmailMessage.normalizeNullable(providerMessageId);
    this.props.lastErrorCode = null;
    this.props.lastErrorMessage = null;
    this.props.processingAt = null;
    this.props.failedAt = null;
    this.props.sentAt = now;
    this.props.updatedAt = now;
  }

  markFailed(errorCode: string, errorMessage: string, retryable: boolean, now = new Date()): void {
    if (this.props.status === EmailMessageStatus.SENT || this.props.status === EmailMessageStatus.CANCELED) {
      return;
    }

    if (this.props.status === EmailMessageStatus.FAILED_PERMANENT) {
      return;
    }

    this.props.status = retryable ? EmailMessageStatus.FAILED_RETRYABLE : EmailMessageStatus.FAILED_PERMANENT;
    this.props.attemptsCount += 1;
    this.props.lastErrorCode = EmailMessage.truncate(errorCode, EmailMessageLimits.lastErrorCodeMaxLength);
    this.props.lastErrorMessage = EmailMessage.truncate(errorMessage, EmailMessageLimits.lastErrorMessageMaxLength);
    this.props.processingAt = null;
    this.props.failedAt = now;
    this.props.updatedAt = now;
  }

  cancel(now = new Date()): void {
    if (this.props.status === EmailMessageStatus.SENT) {
      throw new InvalidEmailMessageError('Cannot cancel an email message that was already sent.');
    }

    if (this.props.status === EmailMessageStatus.CANCELED) {
      return;
    }

    this.props.status = EmailMessageStatus.CANCELED;
    this.props.processingAt = null;
    this.props.updatedAt = now;
  }

  static create(
    props: Omit<EmailMessageProps, 'status' | 'attemptsCount' | 'createdAt' | 'updatedAt'>,
    id: string,
  ): EmailMessage {
    const now = new Date();
    const message = new EmailMessage(
      {
        ...props,
        status: EmailMessageStatus.PENDING,
        attemptsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );

    message.validate();

    return message;
  }

  static reconstitute(props: EmailMessageProps, id: string): EmailMessage {
    return new EmailMessage(props, id);
  }

  private validate(): void {
    if (!this.id.trim()) {
      throw new InvalidEmailMessageError('Email message id is required.');
    }

    EmailMessage.ensureText(this.props.recipientEmail, 'Recipient email is required.');

    if (!this.props.recipientEmail.includes('@')) {
      throw new InvalidEmailMessageError('Recipient email must be valid.');
    }

    EmailMessage.ensureMaxLength(
      this.props.recipientEmail,
      EmailMessageLimits.recipientEmailMaxLength,
      'Recipient email is too long.',
    );
    EmailMessage.ensureNullableMaxLength(
      this.props.recipientName,
      EmailMessageLimits.recipientNameMaxLength,
      'Recipient name is too long.',
    );
    EmailMessage.ensureMaxLength(this.props.provider, EmailMessageLimits.providerMaxLength, 'Provider is too long.');
    EmailMessage.ensureMaxLength(
      this.props.templateKey,
      EmailMessageLimits.templateKeyMaxLength,
      'Template key is too long.',
    );
    EmailMessage.ensureMaxLength(
      this.props.providerTemplateId,
      EmailMessageLimits.providerTemplateIdMaxLength,
      'Provider template id is too long.',
    );
    EmailMessage.ensureMaxLength(
      this.props.idempotencyKey,
      EmailMessageLimits.idempotencyKeyMaxLength,
      'Idempotency key is too long.',
    );
    EmailMessage.ensureText(this.props.idempotencyKey, 'Idempotency key is required.');

    if (!Number.isSafeInteger(this.props.attemptsCount) || this.props.attemptsCount < 0) {
      throw new InvalidEmailMessageError('Attempts count must be a non-negative safe integer.');
    }

    if (
      typeof this.props.templateParams !== 'object' ||
      this.props.templateParams === null ||
      Array.isArray(this.props.templateParams)
    ) {
      throw new InvalidEmailMessageError('Template params must be an object.');
    }
  }

  private static ensureText(value: string, message: string): void {
    if (!value.trim()) {
      throw new InvalidEmailMessageError(message);
    }
  }

  private static ensureMaxLength(value: string, maxLength: number, message: string): void {
    if (value.length > maxLength) {
      throw new InvalidEmailMessageError(message);
    }
  }

  private static ensureNullableMaxLength(value: string | null, maxLength: number, message: string): void {
    if (value !== null && value.length > maxLength) {
      throw new InvalidEmailMessageError(message);
    }
  }

  private static normalizeNullable(value: string | null): string | null {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }

  private static truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }
}
