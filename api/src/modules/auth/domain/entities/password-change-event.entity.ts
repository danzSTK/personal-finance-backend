import {
  PASSWORD_CHANGE_EVENT_METADATA_KEYS,
  PASSWORD_CHANGE_METADATA_VALUE_MAX_LENGTH,
  PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH,
  PasswordChangeEventType,
} from '@/modules/auth/domain/constants/password-change.constants';
import { InvalidPasswordChangeEventError } from '@/modules/auth/domain/errors/invalid-password-change-event.error';
import { isIP } from 'node:net';

export interface PasswordChangeEventMetadata {
  location?: string;
  browser?: string;
  operatingSystem?: string;
  os?: string;
  device?: string;
  correlationId?: string;
  requestId?: string;
}
export interface PasswordChangeEventProps {
  userId: string;
  authProviderId: string | null;
  eventType: PasswordChangeEventType;
  blockedUntil: Date | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Readonly<PasswordChangeEventMetadata>;
  occurredAt: Date;
  createdAt: Date;
}

export interface NewPasswordChangeEventContext {
  userId: string;
  authProviderId: string;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Readonly<PasswordChangeEventMetadata> | null;
  occurredAt: Date;
}

export interface FailedAttemptsBlockStartedInput extends NewPasswordChangeEventContext {
  blockedUntil: Date;
}

export class PasswordChangeEvent {
  private static readonly ALLOWED_METADATA_KEYS = new Set<keyof PasswordChangeEventMetadata>(
    PASSWORD_CHANGE_EVENT_METADATA_KEYS,
  );

  private constructor(
    private readonly props: PasswordChangeEventProps,
    public readonly id: string,
  ) {}

  static create(props: PasswordChangeEventProps, id: string): PasswordChangeEvent {
    const normalizedProps = PasswordChangeEvent.normalizeProps(props);

    PasswordChangeEvent.validate(normalizedProps, id);

    return new PasswordChangeEvent(normalizedProps, id);
  }

  static currentPasswordFailed(input: NewPasswordChangeEventContext, id: string): PasswordChangeEvent {
    return PasswordChangeEvent.create(
      {
        ...PasswordChangeEvent.contextToProps(input),
        eventType: PasswordChangeEventType.CURRENT_PASSWORD_FAILED,
        blockedUntil: null,
      },
      id,
    );
  }

  static passwordChanged(input: NewPasswordChangeEventContext, id: string): PasswordChangeEvent {
    return PasswordChangeEvent.create(
      {
        ...PasswordChangeEvent.contextToProps(input),
        eventType: PasswordChangeEventType.PASSWORD_CHANGED,
        blockedUntil: null,
      },
      id,
    );
  }

  static failedAttemptsBlockStarted(input: FailedAttemptsBlockStartedInput, id: string): PasswordChangeEvent {
    return PasswordChangeEvent.create(
      {
        ...PasswordChangeEvent.contextToProps(input),
        eventType: PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED,
        blockedUntil: input.blockedUntil,
      },
      id,
    );
  }

  static reconstitute(props: PasswordChangeEventProps, id: string): PasswordChangeEvent {
    return new PasswordChangeEvent(PasswordChangeEvent.normalizeProps(props), id);
  }

  get userId(): string {
    return this.props.userId;
  }

  get authProviderId(): string | null {
    return this.props.authProviderId;
  }

  get eventType(): PasswordChangeEventType {
    return this.props.eventType;
  }

  get blockedUntil(): Date | null {
    return this.props.blockedUntil ? new Date(this.props.blockedUntil) : null;
  }

  get sessionId(): string | null {
    return this.props.sessionId;
  }

  get ipAddress(): string | null {
    return this.props.ipAddress;
  }

  get userAgent(): string | null {
    return this.props.userAgent;
  }

  get metadata(): Readonly<PasswordChangeEventMetadata> {
    return this.props.metadata;
  }

  get occurredAt(): Date {
    return new Date(this.props.occurredAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get isFailedAttempt(): boolean {
    return this.eventType === PasswordChangeEventType.CURRENT_PASSWORD_FAILED;
  }

  get isPasswordChanged(): boolean {
    return this.eventType === PasswordChangeEventType.PASSWORD_CHANGED;
  }

  get isBlockStarted(): boolean {
    return this.eventType === PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED;
  }

  isBlockActiveAt(now: Date): boolean {
    return this.isBlockStarted && this.props.blockedUntil !== null && this.props.blockedUntil > now;
  }

  private static contextToProps(
    input: NewPasswordChangeEventContext,
  ): Omit<PasswordChangeEventProps, 'eventType' | 'blockedUntil'> {
    return {
      userId: input.userId,
      authProviderId: input.authProviderId,
      sessionId: input.sessionId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt,
      createdAt: input.occurredAt,
    };
  }

  private static validate(props: PasswordChangeEventProps, id: string): void {
    if (!id.trim()) {
      throw new InvalidPasswordChangeEventError('Password change event id is required.');
    }

    if (!props.userId) {
      throw new InvalidPasswordChangeEventError('Password change event user id is required.');
    }

    if (!props.authProviderId) {
      throw new InvalidPasswordChangeEventError('Password change event auth provider id is required.');
    }

    if (!Object.values(PasswordChangeEventType).includes(props.eventType)) {
      throw new InvalidPasswordChangeEventError('Password change event type is invalid.');
    }

    if (Number.isNaN(props.occurredAt.getTime())) {
      throw new InvalidPasswordChangeEventError('Password change event occurredAt is invalid.');
    }

    if (Number.isNaN(props.createdAt.getTime())) {
      throw new InvalidPasswordChangeEventError('Password change event createdAt is invalid.');
    }

    if (props.ipAddress && isIP(props.ipAddress) === 0) {
      throw new InvalidPasswordChangeEventError('Password change event IP address is invalid.');
    }

    if (props.userAgent && props.userAgent.length > PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH) {
      throw new InvalidPasswordChangeEventError(
        `Password change event User-Agent cannot exceed ${PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH} characters.`,
      );
    }

    if (Array.isArray(props.metadata) || typeof props.metadata !== 'object' || props.metadata === null) {
      throw new InvalidPasswordChangeEventError('Password change event metadata must be an object.');
    }

    PasswordChangeEvent.validateMetadata(props.metadata);

    if (props.eventType === PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED) {
      PasswordChangeEvent.validateBlock(props);
      return;
    }

    if (props.blockedUntil !== null) {
      throw new InvalidPasswordChangeEventError('Only a failed-attempts block event may contain blockedUntil.');
    }
  }

  private static validateMetadata(metadata: Readonly<PasswordChangeEventMetadata>): void {
    for (const [key, value] of Object.entries(metadata)) {
      if (!PasswordChangeEvent.ALLOWED_METADATA_KEYS.has(key as keyof PasswordChangeEventMetadata)) {
        throw new InvalidPasswordChangeEventError(`Password change event metadata key "${key}" is not allowed.`);
      }

      if (value !== undefined && typeof value !== 'string') {
        throw new InvalidPasswordChangeEventError(`Password change event metadata value "${key}" must be a string.`);
      }

      if (value && value.length > PASSWORD_CHANGE_METADATA_VALUE_MAX_LENGTH) {
        throw new InvalidPasswordChangeEventError(
          `Password change event metadata value "${key}" cannot exceed ${PASSWORD_CHANGE_METADATA_VALUE_MAX_LENGTH} characters.`,
        );
      }
    }
  }

  private static normalizeProps(props: PasswordChangeEventProps): PasswordChangeEventProps {
    return {
      ...props,
      userId: props.userId.trim(),
      authProviderId: props.authProviderId?.trim() || null,
      sessionId: props.sessionId?.trim() || null,
      ipAddress: props.ipAddress?.trim() || null,
      userAgent: props.userAgent?.trim() || null,
      metadata: Object.freeze({ ...props.metadata }),
      occurredAt: new Date(props.occurredAt),
      createdAt: new Date(props.createdAt),
      blockedUntil: props.blockedUntil ? new Date(props.blockedUntil) : null,
    };
  }

  private static validateBlock(props: PasswordChangeEventProps): void {
    if (!props.blockedUntil || Number.isNaN(props.blockedUntil.getTime())) {
      throw new InvalidPasswordChangeEventError('Block event requires a valid blockedUntil.');
    }

    if (props.blockedUntil <= props.occurredAt) {
      throw new InvalidPasswordChangeEventError('Block must end after the event occurrence.');
    }
  }
}
