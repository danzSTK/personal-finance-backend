import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type PasswordChangeStateRefreshRequestedPayload = {
  userId: string;
  sourceEventId: string;
  mutationToken: string | null;
};

interface RehydrateInput extends PasswordChangeStateRefreshRequestedPayload {
  occurredAt: Date;
}

export class PasswordChangeStateRefreshRequestedEvent implements DomainEvent<PasswordChangeStateRefreshRequestedPayload> {
  static readonly eventName = AppEventNames.PasswordChangeStateRefreshRequested;
  static readonly aggregateType = 'User';
  static readonly eventVersion = 1;

  readonly eventName = PasswordChangeStateRefreshRequestedEvent.eventName;
  readonly aggregateType = PasswordChangeStateRefreshRequestedEvent.aggregateType;
  readonly eventVersion = PasswordChangeStateRefreshRequestedEvent.eventVersion;
  readonly aggregateId: string;
  readonly deduplicationKey: string;
  readonly occurredAt: Date;

  private constructor(
    readonly userId: string,
    readonly sourceEventId: string,
    readonly mutationToken: string | null,
    occurredAt: Date,
  ) {
    this.aggregateId = userId;
    this.occurredAt = new Date(occurredAt);
    this.deduplicationKey = `${this.eventName}:${sourceEventId}`;
  }

  toPayload(): PasswordChangeStateRefreshRequestedPayload {
    return {
      userId: this.userId,
      sourceEventId: this.sourceEventId,
      mutationToken: this.mutationToken,
    };
  }

  static create(
    userId: string,
    sourceEventId: string,
    occurredAt: Date,
    mutationToken: string | null,
  ): PasswordChangeStateRefreshRequestedEvent {
    return new PasswordChangeStateRefreshRequestedEvent(userId, sourceEventId, mutationToken, occurredAt);
  }

  static rehydrate(input: RehydrateInput): PasswordChangeStateRefreshRequestedEvent {
    return new PasswordChangeStateRefreshRequestedEvent(
      input.userId,
      input.sourceEventId,
      input.mutationToken,
      input.occurredAt,
    );
  }
}
