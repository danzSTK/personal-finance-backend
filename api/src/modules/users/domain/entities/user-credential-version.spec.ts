import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import { User } from '@/modules/users/domain/entities/user.entity';
import { randomUUID } from 'node:crypto';

describe('User credential version', () => {
  const makeUser = (credentialVersion?: number): User =>
    User.reconstitute(
      {
        userName: null,
        firstName: null,
        lastName: null,
        email: Email.reconstitute('user@example.com'),
        status: UserStatus.ACTIVE,
        avatarAssetId: null,
        authProviders: [],
        credentialVersion,
        createdAt: new Date('2026-07-30T10:00:00.000Z'),
        updatedAt: new Date('2026-07-30T10:00:00.000Z'),
      },
      randomUUID(),
    );

  it('defaults reconstituted legacy users to version one', () => {
    expect(makeUser().credentialVersion).toBe(1);
  });

  it('increments the credential version and updates the modification instant', () => {
    const user = makeUser(3);
    const changedAt = new Date('2026-07-30T12:00:00.000Z');

    user.incrementCredentialVersion(changedAt);

    expect(user.credentialVersion).toBe(4);
    expect(user.updatedAt).toEqual(changedAt);
  });
});
