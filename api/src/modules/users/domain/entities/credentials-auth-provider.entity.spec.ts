import { AuthProviderType } from '@/common/models/enums';
import { CredentialsAuthProvider } from '@/modules/users/domain/entities/credentials-auth-provider.entity';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { randomUUID } from 'node:crypto';

describe('CredentialsAuthProvider', () => {
  describe('changePasswordHash', () => {
    it('replaces the hash and updates the modification instant', () => {
      const createdAt = new Date('2026-07-30T10:00:00.000Z');
      const changedAt = new Date('2026-07-30T12:00:00.000Z');
      const provider = CredentialsAuthProvider.create(
        {
          provider: AuthProviderType.EMAIL,
          providerUserId: 'user@example.com',
          passwordHash: HashedPassword.reconstitute('old-hash'),
          userId: randomUUID(),
          createdAt,
          updatedAt: createdAt,
        },
        randomUUID(),
      );

      provider.changePasswordHash(HashedPassword.reconstitute('new-hash'), changedAt);

      expect(provider.passwordHash.value).toBe('new-hash');
      expect(provider.updatedAt).toEqual(changedAt);
    });
  });
});
