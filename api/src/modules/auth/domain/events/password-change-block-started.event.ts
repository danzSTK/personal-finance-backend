import { PasswordChangeSecurityContext } from '@/modules/auth/domain/events/password-change-security-context';
import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type PasswordChangeBlockStartedEventPayload = {
  userId: string;
  sourceEventId: string;
  blockedUntil: string;
  securityContext: PasswordChangeSecurityContext;
};

interface PasswordChangeBlockStartedEventRehydrateInput {
  userId: string;
  sourceEventId: string;
  blockedUntil: Date;
  securityContext: PasswordChangeSecurityContext;
  occurredAt: Date;
}

export class PasswordChangeBlockStartedEvent implements DomainEvent<PasswordChangeBlockStartedEventPayload> {
  static readonly eventName = AppEventNames.PasswordChangeBlockStarted;
  static readonly aggregateType = 'User';
  static readonly eventVersion = 1;

  readonly eventName = PasswordChangeBlockStartedEvent.eventName;
  readonly aggregateType = PasswordChangeBlockStartedEvent.aggregateType;
  readonly eventVersion = PasswordChangeBlockStartedEvent.eventVersion;
  readonly aggregateId: string;
  readonly deduplicationKey: string;
  readonly blockedUntil: Date;
  readonly occurredAt: Date;

  private constructor(
    readonly userId: string,
    readonly sourceEventId: string,
    blockedUntil: Date,
    readonly securityContext: PasswordChangeSecurityContext,
    occurredAt: Date,
  ) {
    this.aggregateId = userId;
    this.blockedUntil = new Date(blockedUntil);
    this.occurredAt = new Date(occurredAt);
    this.securityContext = Object.freeze({ ...securityContext });
    this.deduplicationKey = `${this.eventName}:${sourceEventId}`;
  }

  static create(
    userId: string,
    sourceEventId: string,
    blockedUntil: Date,
    securityContext: PasswordChangeSecurityContext,
    occurredAt: Date,
  ): PasswordChangeBlockStartedEvent {
    return new PasswordChangeBlockStartedEvent(userId, sourceEventId, blockedUntil, securityContext, occurredAt);
  }

  static rehydrate(input: PasswordChangeBlockStartedEventRehydrateInput): PasswordChangeBlockStartedEvent {
    return new PasswordChangeBlockStartedEvent(
      input.userId,
      input.sourceEventId,
      input.blockedUntil,
      input.securityContext,
      input.occurredAt,
    );
  }

  toPayload(): PasswordChangeBlockStartedEventPayload {
    return {
      userId: this.userId,
      sourceEventId: this.sourceEventId,
      blockedUntil: this.blockedUntil.toISOString(),
      securityContext: this.securityContext,
    };
  }
}
