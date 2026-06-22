import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { AssetStorageKeyFactory } from '@/modules/assets/domain/factories';
import { AssetMapper } from '@/modules/assets/infrastructure/mappers/asset.mapper';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { AssetRepository } from '@/modules/assets/infrastructure/persistence/asset.repository';
import { EntityManager, Repository } from 'typeorm';

describe('AssetRepository', () => {
  const assetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';

  it('uses the transactional repository when an EntityManager is provided', async () => {
    const entity = createOrmEntity();
    const findOne = jest.fn().mockResolvedValue(entity);
    const transactionalRepository = {
      findOne,
    } as unknown as Repository<AssetOrmEntity>;
    const getRepository = jest.fn().mockReturnValue(transactionalRepository);
    const manager = {
      getRepository,
    } as unknown as EntityManager;
    const defaultFindOne = jest.fn();
    const defaultRepository = { findOne: defaultFindOne } as unknown as Repository<AssetOrmEntity>;
    const repository = new AssetRepository(defaultRepository);

    const result = await repository.findByIdAndUserId(assetId, userId, { manager });

    expect(result?.id).toBe(assetId);
    expect(getRepository).toHaveBeenCalledWith(AssetOrmEntity);
    expect(defaultFindOne).not.toHaveBeenCalled();
  });

  it('persists mapped asset state', async () => {
    const entity = createOrmEntity();
    const save = jest.fn().mockResolvedValue(entity);
    const ormRepository = {
      save,
    } as unknown as Repository<AssetOrmEntity>;
    const repository = new AssetRepository(ormRepository);
    const asset = AssetMapper.toDomain(entity);

    const result = await repository.save(asset);

    expect(result.id).toBe(assetId);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: assetId, userId }));
  });

  function createOrmEntity(): AssetOrmEntity {
    return {
      id: assetId,
      userId,
      purpose: AssetPurpose.USER_AVATAR,
      status: AssetStatus.PENDING_UPLOAD,
      bucket: 'public-assets',
      storageKey: AssetStorageKeyFactory.create({ assetId, userId, purpose: AssetPurpose.USER_AVATAR }).value,
      contentType: null,
      sizeBytes: null,
      checksum: null,
      metadata: {},
      failureCode: null,
      readyAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: undefined as never,
    };
  }
});
