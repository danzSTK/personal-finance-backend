import { UserStatus } from '@/common/models/enums';
import { User } from '@/modules/users/domain/entities/user.entity';
import { InvalidUserError } from '@/modules/users/domain/errors/invalid-user.error';
import { UserAvatarUpdatedEvent } from '@/modules/users/domain/events/user-avatar-updated.event';
import { UserAvatarRemovedEvent } from '@/modules/users/domain/events/user-avatar-removed.event';
import { Email } from '@/common/domain/value-objects/email.value-object';

describe('User avatar', () => {
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  const previousAssetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
  const currentAssetId = 'fe52a36f-5fc7-43ce-8827-52a6aa17d478';

  it('changes the avatar reference and records its previous asset', () => {
    const user = createUser(previousAssetId);

    const previous = user.changeAvatarAsset(currentAssetId);
    const [event] = user.pullDomainEvents();

    expect(previous).toBe(previousAssetId);
    expect(user.avatarAssetId).toBe(currentAssetId);
    expect(event).toBeInstanceOf(UserAvatarUpdatedEvent);
    expect((event as UserAvatarUpdatedEvent).deduplicationKey).toBeNull();
    expect((event as UserAvatarUpdatedEvent).toPayload()).toEqual({
      userId,
      previousAssetId,
      currentAssetId,
    });
  });

  it('does not emit another event when the avatar is unchanged', () => {
    const user = createUser(currentAssetId);

    user.changeAvatarAsset(currentAssetId);

    expect(user.pullDomainEvents()).toEqual([]);
  });

  it('rejects an empty asset id', () => {
    const user = createUser(null);

    expect(() => user.changeAvatarAsset(' ')).toThrow(InvalidUserError);
  });

  it('removes the avatar reference and records the previous asset', () => {
    const user = createUser(previousAssetId);

    const previous = user.removeAvatarAsset();
    const [event] = user.pullDomainEvents();

    expect(previous).toBe(previousAssetId);
    expect(user.avatarAssetId).toBeNull();
    expect(event).toBeInstanceOf(UserAvatarRemovedEvent);
    expect((event as UserAvatarRemovedEvent).toPayload()).toEqual({ userId, previousAssetId });
  });

  it('does not emit an event when the user has no avatar', () => {
    const user = createUser(null);

    expect(user.removeAvatarAsset()).toBeNull();
    expect(user.pullDomainEvents()).toEqual([]);
  });

  function createUser(avatarAssetId: string | null): User {
    return User.reconstitute(
      {
        email: Email.reconstitute('user@example.com'),
        userName: null,
        firstName: null,
        lastName: null,
        status: UserStatus.ACTIVE,
        avatarAssetId,
        authProviders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      userId,
    );
  }
});
