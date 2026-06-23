import { DeleteAvatarAssetUseCase } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { AssetFactory } from '@/modules/assets/domain/factories';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { IObjectStorage } from '@/shared/object-storage';

describe('DeleteAvatarAssetUseCase', () => {
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  let assetRepository: jest.Mocked<IAssetRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let findByIdAndUserId: jest.MockedFunction<IAssetRepository['findByIdAndUserId']>;
  let save: jest.MockedFunction<IAssetRepository['save']>;
  let deleteObject: jest.MockedFunction<IObjectStorage['deleteObject']>;
  let useCase: DeleteAvatarAssetUseCase;

  beforeEach(() => {
    findByIdAndUserId = jest.fn();
    save = jest.fn().mockImplementation(asset => Promise.resolve(asset));
    deleteObject = jest.fn();
    assetRepository = { findByIdAndUserId, save };
    objectStorage = {
      putObject: jest.fn(),
      deleteObject,
      headObject: jest.fn(),
      buildPublicUrl: jest.fn(),
    };
    useCase = new DeleteAvatarAssetUseCase(assetRepository, objectStorage);
  });

  it('marks a ready avatar for deletion before deleting and finalizing it', async () => {
    const asset = createReadyAsset();
    const persistedStatuses: AssetStatus[] = [];
    findByIdAndUserId.mockResolvedValue(asset);
    save.mockImplementation((value: Asset) => {
      persistedStatuses.push(value.status);
      return Promise.resolve(value);
    });

    await useCase.execute({ userId, assetId: asset.id });

    expect(persistedStatuses).toEqual([AssetStatus.DELETE_PENDING, AssetStatus.DELETED]);
    expect(deleteObject).toHaveBeenCalledWith({ bucket: asset.bucket, key: asset.storageKey });
  });

  it('resumes deletion when the asset is already delete pending', async () => {
    const asset = createReadyAsset();
    asset.markDeletePending();
    findByIdAndUserId.mockResolvedValue(asset);

    await useCase.execute({ userId, assetId: asset.id });

    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(asset.status).toBe(AssetStatus.DELETED);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the asset was already deleted', async () => {
    const asset = createReadyAsset();
    asset.markDeletePending();
    asset.markDeleted();
    findByIdAndUserId.mockResolvedValue(asset);

    await useCase.execute({ userId, assetId: asset.id });

    expect(deleteObject).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('leaves the asset delete pending when Object Storage fails', async () => {
    const asset = createReadyAsset();
    findByIdAndUserId.mockResolvedValue(asset);
    deleteObject.mockRejectedValue(new Error('storage unavailable'));

    await expect(useCase.execute({ userId, assetId: asset.id })).rejects.toThrow('storage unavailable');

    expect(asset.status).toBe(AssetStatus.DELETE_PENDING);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the asset cannot be found', async () => {
    findByIdAndUserId.mockResolvedValue(null);

    await useCase.execute({ userId, assetId: 'missing' });

    expect(deleteObject).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  function createReadyAsset(): Asset {
    const asset = AssetFactory.createPendingUpload({
      userId,
      purpose: AssetPurpose.USER_AVATAR,
      bucket: 'public-assets',
    });
    asset.markReady({
      contentType: 'image/webp',
      sizeBytes: 1024,
      checksum: 'a'.repeat(64),
      metadata: { width: 512, height: 512, format: 'webp' },
    });

    return asset;
  }
});
