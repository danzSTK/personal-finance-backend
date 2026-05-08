import { UserStatus } from '@/common/models/enums';
import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

export class UserCreatedEvent implements DomainEvent {
  public static readonly eventName = AppEventNames.UserCreated;

  public readonly eventName = UserCreatedEvent.eventName;
  public readonly aggregateId: string;
  public readonly occurredAt: Date;

  private constructor(
    public readonly userId: string,
    public readonly status: UserStatus,
    occurredAt?: Date,
  ) {
    this.aggregateId = userId;
    this.occurredAt = occurredAt ?? new Date();
  }

  static create(userId: string, status: UserStatus): UserCreatedEvent {
    return new UserCreatedEvent(userId, status);
  }
}
