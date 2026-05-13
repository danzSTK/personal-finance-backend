import { UserStatus } from '@/common/models/enums';
import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type UserCreatedEventPayload = {
  userId: string;
  status: UserStatus;
};

export class UserCreatedEvent implements DomainEvent<UserCreatedEventPayload> {
  public static readonly eventName = AppEventNames.UserCreated;

  public readonly eventName = UserCreatedEvent.eventName;
  public readonly eventVersion = 1;
  public readonly aggregateType = 'User';
  public readonly aggregateId: string;
  public readonly deduplicationKey: string | null = null;
  public readonly occurredAt: Date;

  private constructor(
    public readonly userId: string,
    public readonly status: UserStatus,
    occurredAt = new Date(),
  ) {
    this.aggregateId = userId;
    this.deduplicationKey = `${this.eventName}:${userId}`;
    this.occurredAt = occurredAt;
  }

  static create(userId: string, status: UserStatus): UserCreatedEvent {
    return new UserCreatedEvent(userId, status);
  }

  toPayload(): UserCreatedEventPayload {
    return {
      userId: this.userId,
      status: this.status,
    };
  }
}
