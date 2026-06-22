import { DomainEvent } from '@/shared/domain/domain-event.interface';
import { AppEventNames } from '@/shared/events';

type UserAvatarUpdatedEventPayload = {
  userId: string;
  previousAssetId: string | null;
  currentAssetId: string;
};

type RehydrateInput = UserAvatarUpdatedEventPayload & {
  occurredAt: Date;
};

export class UserAvatarUpdatedEvent implements DomainEvent<UserAvatarUpdatedEventPayload> {
  public static readonly eventName = AppEventNames.UserAvatarUpdated;
  public static readonly aggregateType = 'User';
  public static readonly eventVersion = 1;

  public readonly eventName = UserAvatarUpdatedEvent.eventName;
  public readonly aggregateType = UserAvatarUpdatedEvent.aggregateType;
  public readonly eventVersion = UserAvatarUpdatedEvent.eventVersion;
  public readonly aggregateId: string;
  public readonly deduplicationKey = null;
  public readonly occurredAt: Date;

  private constructor(
    public readonly userId: string,
    public readonly previousAssetId: string | null,
    public readonly currentAssetId: string,
    occurredAt?: Date,
  ) {
    this.aggregateId = userId;
    this.occurredAt = occurredAt ?? new Date();
  }

  toPayload(): UserAvatarUpdatedEventPayload {
    return {
      userId: this.userId,
      previousAssetId: this.previousAssetId,
      currentAssetId: this.currentAssetId,
    };
  }

  static create(userId: string, previousAssetId: string | null, currentAssetId: string): UserAvatarUpdatedEvent {
    return new UserAvatarUpdatedEvent(userId, previousAssetId, currentAssetId);
  }

  static rehydrate(input: RehydrateInput): UserAvatarUpdatedEvent {
    return new UserAvatarUpdatedEvent(input.userId, input.previousAssetId, input.currentAssetId, input.occurredAt);
  }
}
