import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type UserEmailVerifiedEventPayload = {
  userId: string;
  email: string;
};

type RehydrateInput = UserEmailVerifiedEventPayload & {
  occurredAt: Date;
};

export class UserEmailVerifiedEvent implements DomainEvent<UserEmailVerifiedEventPayload> {
  public static readonly eventName = AppEventNames.UserEmailVerified;
  public static readonly aggregateType = 'User';
  public static readonly eventVersion = 1;

  public readonly eventName = UserEmailVerifiedEvent.eventName;
  public readonly aggregateType = UserEmailVerifiedEvent.aggregateType;
  public readonly eventVersion = UserEmailVerifiedEvent.eventVersion;
  public readonly aggregateId: string;
  public readonly deduplicationKey: string;
  public readonly occurredAt: Date;

  private constructor(
    public readonly userId: string,
    public readonly email: Email,
    occurredAt?: Date,
  ) {
    this.aggregateId = userId;
    this.deduplicationKey = `${this.eventName}:${userId}`;
    this.occurredAt = occurredAt ?? new Date();
  }

  toPayload(): UserEmailVerifiedEventPayload {
    return {
      userId: this.userId,
      email: this.email.value,
    };
  }

  static create(userId: string, email: Email): UserEmailVerifiedEvent {
    return new UserEmailVerifiedEvent(userId, email);
  }

  static rehydrate(input: RehydrateInput): UserEmailVerifiedEvent {
    return new UserEmailVerifiedEvent(input.userId, Email.create(input.email), input.occurredAt);
  }
}
