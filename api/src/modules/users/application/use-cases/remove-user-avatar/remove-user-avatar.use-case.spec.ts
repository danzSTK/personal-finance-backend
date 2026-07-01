import { UserStatus } from '@/common/models/enums';
import { UserNotFoundError } from '@/modules/users/application/errors';
import { IUserCacheInvalidator } from '@/modules/users/application/ports/user-cache-invalidator.interface';
import { RemoveUserAvatarUseCase } from '@/modules/users/application/use-cases/remove-user-avatar/remove-user-avatar.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { DataSource, EntityManager } from 'typeorm';

describe('RemoveUserAvatarUseCase', () => {
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  const avatarAssetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
  const manager = {} as EntityManager;
  let transaction: jest.MockedFunction<
    (callback: (transactionManager: EntityManager) => Promise<unknown>) => Promise<unknown>
  >;
  let findByIdForUpdate: jest.MockedFunction<IUserRepository['findByIdForUpdate']>;
  let save: jest.MockedFunction<IUserRepository['save']>;
  let storeEvents: jest.MockedFunction<OutboxWriteService['storeEvents']>;
  let invalidate: jest.MockedFunction<IUserCacheInvalidator['invalidate']>;
  let useCase: RemoveUserAvatarUseCase;

  beforeEach(() => {
    transaction = jest.fn(callback => callback(manager));
    findByIdForUpdate = jest.fn();
    save = jest.fn().mockImplementation((user: User) => Promise.resolve(user));
    storeEvents = jest.fn();
    invalidate = jest.fn();

    useCase = new RemoveUserAvatarUseCase(
      { transaction } as unknown as DataSource,
      { findByIdForUpdate, save } as unknown as IUserRepository,
      { storeEvents } as unknown as OutboxWriteService,
      { invalidate } as unknown as IUserCacheInvalidator,
    );
  });

  it('removes the reference and stores the domain event in the same transaction', async () => {
    const user = createUser(avatarAssetId);
    findByIdForUpdate.mockResolvedValue(user);

    await useCase.execute({ userId });

    expect(user.avatarAssetId).toBeNull();
    expect(save).toHaveBeenCalledWith(user, { manager });
    expect(storeEvents).toHaveBeenCalledWith(
      [expect.objectContaining({ eventName: 'user.avatar.removed', previousAssetId: avatarAssetId })],
      { manager },
    );
    expect(invalidate).toHaveBeenCalledWith(user);
  });

  it('is idempotent when the user already has no avatar', async () => {
    findByIdForUpdate.mockResolvedValue(createUser(null));

    await useCase.execute({ userId });

    expect(save).not.toHaveBeenCalled();
    expect(storeEvents).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('rejects removal when the authenticated user no longer exists', async () => {
    findByIdForUpdate.mockResolvedValue(null);

    await expect(useCase.execute({ userId })).rejects.toBeInstanceOf(UserNotFoundError);
  });

  function createUser(currentAvatarAssetId: string | null): User {
    return User.reconstitute(
      {
        email: Email.reconstitute('user@example.com'),
        userName: null,
        firstName: null,
        lastName: null,
        status: UserStatus.ACTIVE,
        avatarAssetId: currentAvatarAssetId,
        authProviders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      userId,
    );
  }
});
