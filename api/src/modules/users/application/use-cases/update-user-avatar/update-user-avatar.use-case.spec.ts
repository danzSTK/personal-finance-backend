import { UserStatus } from '@/common/models/enums';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AvatarUploadFailedError } from '@/modules/users/application/errors';
import {
  IAvatarImageProcessor,
  ProcessedAvatarImage,
} from '@/modules/users/application/ports/avatar-image-processor.interface';
import { IUserCacheInvalidator } from '@/modules/users/application/ports/user-cache-invalidator.interface';
import { UpdateUserAvatarUseCase } from '@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { IObjectStorage, ObjectStorageError, ObjectStorageErrorCode } from '@/shared/object-storage';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { DataSource, EntityManager } from 'typeorm';

describe('UpdateUserAvatarUseCase', () => {
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  const manager = {} as EntityManager;
  const processed: ProcessedAvatarImage = {
    bytes: Buffer.from('webp'),
    contentType: 'image/webp',
    sizeBytes: 4,
    checksum: 'a'.repeat(64),
    metadata: { width: 512, height: 512, format: 'webp' },
  };

  let transaction: jest.MockedFunction<
    (callback: (transactionManager: EntityManager) => Promise<unknown>) => Promise<unknown>
  >;
  let assetSave: jest.MockedFunction<IAssetRepository['save']>;
  let findAsset: jest.MockedFunction<IAssetRepository['findByIdAndUserId']>;
  let findUserForUpdate: jest.MockedFunction<IUserRepository['findByIdForUpdate']>;
  let userSave: jest.MockedFunction<IUserRepository['save']>;
  let putObject: jest.MockedFunction<IObjectStorage['putObject']>;
  let deleteObject: jest.MockedFunction<IObjectStorage['deleteObject']>;
  let storeEvents: jest.MockedFunction<OutboxWriteService['storeEvents']>;
  let invalidateCache: jest.MockedFunction<IUserCacheInvalidator['invalidate']>;
  let useCase: UpdateUserAvatarUseCase;

  beforeEach(() => {
    transaction = jest.fn(callback => callback(manager));
    assetSave = jest.fn().mockImplementation((asset: Asset) => Promise.resolve(asset));
    findAsset = jest.fn();
    findUserForUpdate = jest.fn().mockResolvedValue(createUser());
    userSave = jest.fn().mockImplementation((user: User) => Promise.resolve(user));
    putObject = jest.fn();
    deleteObject = jest.fn();
    storeEvents = jest.fn();
    invalidateCache = jest.fn();

    const dataSource = { transaction } as unknown as DataSource;
    const assetRepository = {
      save: assetSave,
      findByIdAndUserId: findAsset,
    } as unknown as IAssetRepository;
    const userRepository = {
      findByIdForUpdate: findUserForUpdate,
      save: userSave,
    } as unknown as IUserRepository;
    const imageProcessor = {
      process: jest.fn().mockResolvedValue(processed),
    } as unknown as IAvatarImageProcessor;
    const objectStorage = {
      putObject,
      deleteObject,
      headObject: jest.fn(),
      buildPublicUrl: jest.fn().mockReturnValue('https://assets.example/avatar.webp'),
    } as unknown as IObjectStorage;
    const outboxWriter = { storeEvents } as unknown as OutboxWriteService;
    const cacheInvalidator = { invalidate: invalidateCache } as unknown as IUserCacheInvalidator;

    let pendingAsset: Asset | undefined;
    assetSave.mockImplementation((asset: Asset) => {
      pendingAsset = asset;
      return Promise.resolve(asset);
    });
    findAsset.mockImplementation(() => Promise.resolve(pendingAsset ?? null));

    useCase = new UpdateUserAvatarUseCase(
      dataSource,
      {
        publicBucketName: 'public-assets',
      } as never,
      userRepository,
      assetRepository,
      imageProcessor,
      objectStorage,
      outboxWriter,
      cacheInvalidator,
    );
  });

  it('uploads the image and commits asset, user and outbox together', async () => {
    const output = await useCase.execute({ userId, bytes: Buffer.from('input') });

    expect(putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'public-assets',
        body: processed.bytes,
        contentType: 'image/webp',
        checksumSha256Hex: processed.checksum,
      }),
    );
    expect(findUserForUpdate).toHaveBeenCalledWith(userId, { manager });
    expect(storeEvents).toHaveBeenCalledWith([expect.objectContaining({ eventName: 'user.avatar.updated' })], {
      manager,
    });
    expect(invalidateCache).toHaveBeenCalledTimes(1);
    expect(typeof output.assetId).toBe('string');
    expect(output.url).toBe('https://assets.example/avatar.webp');
  });

  it('marks the pending asset as failed when Object Storage rejects the upload', async () => {
    putObject.mockRejectedValue(
      new ObjectStorageError({
        code: ObjectStorageErrorCode.UNAVAILABLE,
        operation: 'PUT',
        retryable: true,
      }),
    );

    await expect(useCase.execute({ userId, bytes: Buffer.from('input') })).rejects.toBeInstanceOf(
      AvatarUploadFailedError,
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(assetSave).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'FAILED' }));
  });

  it('removes the uploaded object when database finalization fails', async () => {
    transaction.mockRejectedValue(new Error('database unavailable'));

    await expect(useCase.execute({ userId, bytes: Buffer.from('input') })).rejects.toThrow('database unavailable');

    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(invalidateCache).not.toHaveBeenCalled();
  });

  function createUser(): User {
    return User.reconstitute(
      {
        email: Email.reconstitute('user@example.com'),
        userName: null,
        firstName: null,
        lastName: null,
        status: UserStatus.ACTIVE,
        avatarAssetId: null,
        authProviders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      userId,
    );
  }
});
