import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type UserSessionsRevokeAllRequestedEventPayload = {
  userId: string;
  sourceEventId: string;
};

type UserSessionsRevokeAllRequestedEventRehydrateInput = UserSessionsRevokeAllRequestedEventPayload & {
  occurredAt: Date;
};

export class UserSessionsRevokeAllRequestedEvent implements DomainEvent<UserSessionsRevokeAllRequestedEventPayload> {
  static readonly eventName = AppEventNames.UserSessionsRevokeAllRequested;
  static readonly aggregateType = 'User';
  static readonly eventVersion = 1;

  readonly eventName = UserSessionsRevokeAllRequestedEvent.eventName;
  readonly aggregateType = UserSessionsRevokeAllRequestedEvent.aggregateType;
  readonly eventVersion = UserSessionsRevokeAllRequestedEvent.eventVersion;
  readonly aggregateId: string;
  readonly deduplicationKey: string;
  readonly occurredAt: Date;

  private constructor(
    readonly userId: string,
    readonly sourceEventId: string,
    occurredAt: Date,
  ) {
    this.aggregateId = userId;
    this.occurredAt = new Date(occurredAt);
    this.deduplicationKey = `${this.eventName}:${sourceEventId}`;
  }

  static create(userId: string, sourceEventId: string, occurredAt: Date): UserSessionsRevokeAllRequestedEvent {
    return new UserSessionsRevokeAllRequestedEvent(userId, sourceEventId, occurredAt);
  }

  static rehydrate(input: UserSessionsRevokeAllRequestedEventRehydrateInput): UserSessionsRevokeAllRequestedEvent {
    return new UserSessionsRevokeAllRequestedEvent(input.userId, input.sourceEventId, input.occurredAt);
  }

  toPayload(): UserSessionsRevokeAllRequestedEventPayload {
    return {
      userId: this.userId,
      sourceEventId: this.sourceEventId,
    };
  }
}
