import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type UserAvatarRemovedEventPayload = {
  userId: string;
  previousAssetId: string;
};

type RehydrateInput = UserAvatarRemovedEventPayload & {
  occurredAt: Date;
};

export class UserAvatarRemovedEvent implements DomainEvent<UserAvatarRemovedEventPayload> {
  public static readonly eventName = AppEventNames.UserAvatarRemoved;
  public static readonly aggregateType = 'User';
  public static readonly eventVersion = 1;

  public readonly eventName = UserAvatarRemovedEvent.eventName;
  public readonly aggregateType = UserAvatarRemovedEvent.aggregateType;
  public readonly eventVersion = UserAvatarRemovedEvent.eventVersion;
  public readonly aggregateId: string;
  public readonly deduplicationKey = null;
  public readonly occurredAt: Date;

  private constructor(
    public readonly userId: string,
    public readonly previousAssetId: string,
    occurredAt?: Date,
  ) {
    this.aggregateId = userId;
    this.occurredAt = occurredAt ?? new Date();
  }

  toPayload(): UserAvatarRemovedEventPayload {
    return {
      userId: this.userId,
      previousAssetId: this.previousAssetId,
    };
  }

  static create(userId: string, previousAssetId: string): UserAvatarRemovedEvent {
    return new UserAvatarRemovedEvent(userId, previousAssetId);
  }

  static rehydrate(input: RehydrateInput): UserAvatarRemovedEvent {
    return new UserAvatarRemovedEvent(input.userId, input.previousAssetId, input.occurredAt);
  }
}
