import { UserStatus } from '@/common/models/enums';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type UserCreatedEventPayload = {
  userId: string;
  status: UserStatus;
  email: string;
};

type RehydrateInput = {
  userId: string;
  status: UserStatus;
  occurredAt: Date;
  email: string;
};

export class UserCreatedEvent implements DomainEvent<UserCreatedEventPayload> {
  public static readonly eventName = AppEventNames.UserCreated;
  public static readonly aggregateType = 'User';
  public static readonly eventVersion = 1;

  public readonly eventName = UserCreatedEvent.eventName;
  public readonly aggregateType = UserCreatedEvent.aggregateType;
  public readonly eventVersion = UserCreatedEvent.eventVersion;
  public readonly aggregateId: string;
  public readonly deduplicationKey: string | null = null;
  public readonly occurredAt: Date;

  private constructor(
    public readonly userId: string,
    public readonly status: UserStatus,
    public readonly email: Email,
    occurredAt?: Date,
  ) {
    this.aggregateId = userId;
    this.deduplicationKey = `${this.eventName}:${userId}`;
    this.occurredAt = occurredAt || new Date();
  }

  toPayload(): UserCreatedEventPayload {
    return {
      status: this.status,
      userId: this.userId,
      email: this.email.value,
    };
  }

  static create(userId: string, status: UserStatus, email: Email): UserCreatedEvent {
    return new UserCreatedEvent(userId, status, email);
  }

  static rehydrate(props: RehydrateInput): UserCreatedEvent {
    return new UserCreatedEvent(props.userId, props.status, Email.create(props.email), props.occurredAt);
  }
}
