import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { StorageKey } from '@/modules/assets/domain/value-objects';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { GetUserProfileUseCase } from '@/modules/users/application/use-cases/get-user-profile/get-user-profile.use-case';
import { IObjectStorage } from '@/shared/object-storage';
import { UserStatus } from '@/common/models/enums';

describe('GetUserProfileUseCase', () => {
  let useCase: GetUserProfileUseCase;
  let assetRepository: jest.Mocked<IAssetRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let findAssetByIdAndUserId: jest.MockedFunction<IAssetRepository['findByIdAndUserId']>;
  let buildPublicUrl: jest.MockedFunction<IObjectStorage['buildPublicUrl']>;

  beforeEach(() => {
    findAssetByIdAndUserId = jest.fn();
    buildPublicUrl = jest.fn().mockReturnValue('https://assets.example.com/avatar.webp');

    assetRepository = {
      findByIdAndUserId: findAssetByIdAndUserId,
      save: jest.fn(),
    };

    objectStorage = {
      putObject: jest.fn(),
      deleteObject: jest.fn(),
      headObject: jest.fn(),
      buildPublicUrl,
    };

    useCase = new GetUserProfileUseCase(assetRepository, objectStorage);
  });

  it('returns null avatarUrl when the user has no avatar asset', async () => {
    const user = createUser(null);

    const output = await useCase.execute({ user });

    expect(output).toEqual({ user, avatarUrl: null });
    expect(findAssetByIdAndUserId).not.toHaveBeenCalled();
    expect(buildPublicUrl).not.toHaveBeenCalled();
  });

  it('returns null avatarUrl when the asset is not ready', async () => {
    const user = createUser('asset-id');
    findAssetByIdAndUserId.mockResolvedValue(createAsset(AssetStatus.DELETE_PENDING));

    const output = await useCase.execute({ user });

    expect(output.avatarUrl).toBeNull();
    expect(buildPublicUrl).not.toHaveBeenCalled();
  });

  it('returns the public avatar url when the asset is ready', async () => {
    const user = createUser('asset-id');
    findAssetByIdAndUserId.mockResolvedValue(createAsset(AssetStatus.READY));

    const output = await useCase.execute({ user });

    expect(output.avatarUrl).toBe('https://assets.example.com/avatar.webp');
    expect(buildPublicUrl).toHaveBeenCalledWith({
      bucket: 'public-bucket',
      key: 'users/user-id/avatars/asset-id.webp',
    });
  });

  function createUser(avatarAssetId: string | null): User {
    return User.reconstitute(
      {
        userName: null,
        firstName: 'John',
        lastName: 'Doe',
        email: Email.reconstitute('john@example.com'),
        status: UserStatus.ACTIVE,
        avatarAssetId,
        authProviders: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      'user-id',
    );
  }

  function createAsset(status: AssetStatus): Asset {
    return Asset.reconstitute(
      {
        userId: 'user-id',
        purpose: AssetPurpose.USER_AVATAR,
        status,
        bucket: 'public-bucket',
        storageKey: StorageKey.reconstitute('users/user-id/avatars/asset-id.webp'),
        contentType: 'image/webp',
        sizeBytes: 1000,
        checksum: 'a'.repeat(64),
        metadata: {},
        failureCode: null,
        readyAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      'asset-id',
    );
  }
});
