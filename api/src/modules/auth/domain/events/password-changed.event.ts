import { PasswordChangeSecurityContext } from '@/modules/auth/domain/events/password-change-security-context';
import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type PasswordChangedEventPayload = {
  userId: string;
  sourceEventId: string;
  securityContext: PasswordChangeSecurityContext;
};

type PasswordChangedEventRehydrateInput = PasswordChangedEventPayload & {
  occurredAt: Date;
};

export class PasswordChangedEvent implements DomainEvent<PasswordChangedEventPayload> {
  static readonly eventName = AppEventNames.PasswordChanged;
  static readonly aggregateType = 'User';
  static readonly eventVersion = 1;

  readonly eventName = PasswordChangedEvent.eventName;
  readonly aggregateType = PasswordChangedEvent.aggregateType;
  readonly eventVersion = PasswordChangedEvent.eventVersion;
  readonly aggregateId: string;
  readonly deduplicationKey: string;
  readonly occurredAt: Date;

  private constructor(
    readonly userId: string,
    readonly sourceEventId: string,
    readonly securityContext: PasswordChangeSecurityContext,
    occurredAt: Date,
  ) {
    this.aggregateId = userId;
    this.occurredAt = new Date(occurredAt);
    this.securityContext = Object.freeze({ ...securityContext });
    this.deduplicationKey = `${this.eventName}:${sourceEventId}`;
  }

  static create(
    userId: string,
    sourceEventId: string,
    securityContext: PasswordChangeSecurityContext,
    occurredAt: Date,
  ): PasswordChangedEvent {
    return new PasswordChangedEvent(userId, sourceEventId, securityContext, occurredAt);
  }

  static rehydrate(input: PasswordChangedEventRehydrateInput): PasswordChangedEvent {
    return new PasswordChangedEvent(input.userId, input.sourceEventId, input.securityContext, input.occurredAt);
  }

  toPayload(): PasswordChangedEventPayload {
    return {
      userId: this.userId,
      sourceEventId: this.sourceEventId,
      securityContext: this.securityContext,
    };
  }
}
