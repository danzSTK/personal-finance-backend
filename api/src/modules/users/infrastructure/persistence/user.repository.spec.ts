import { UserStatus } from '@/common/models/enums';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import { UserRepository } from '@/modules/users/infrastructure/persistence/user.repository';
import { EntityManager, Repository } from 'typeorm';

describe('UserRepository', () => {
  describe('findByIdForUpdate', () => {
    it('locks the user row before loading its relations', async () => {
      const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
      const user = createUserOrmEntity(userId);
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, authProviders: [] });
      const repository = { findOne } as unknown as Repository<UserOrmEntity>;
      const manager = { getRepository: jest.fn().mockReturnValue(repository) } as unknown as EntityManager;
      const userRepository = new UserRepository(repository);

      const result = await userRepository.findByIdForUpdate(userId, { manager });

      expect(result?.id).toBe(userId);
      expect(findOne).toHaveBeenNthCalledWith(1, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(findOne).toHaveBeenNthCalledWith(2, {
        where: { id: userId },
        relations: ['authProviders'],
      });
    });
  });

  function createUserOrmEntity(id: string): UserOrmEntity {
    return {
      id,
      email: 'user@example.com',
      userName: null,
      firstName: null,
      lastName: null,
      status: UserStatus.ACTIVE,
      avatarAssetId: null,
      created_at: new Date(),
      updated_at: new Date(),
      accounts: [],
      categories: [],
      assets: [],
      avatarAsset: null,
      transactions: [],
      authProviders: [],
    };
  }
});
