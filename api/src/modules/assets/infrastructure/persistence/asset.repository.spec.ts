/* eslint-disable @typescript-eslint/unbound-method */
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

  describe('findPendingDeletionBefore', () => {
    it('finds and claims assets pending deletion using provided manager with pessimistic lock and skip locked', async () => {
      const entity = createOrmEntity();
      entity.status = AssetStatus.DELETE_PENDING;
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        setOnLocked: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([entity]),
      };
      const update = jest.fn().mockResolvedValue(undefined);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        update,
      } as unknown as EntityManager;

      const repository = new AssetRepository({} as unknown as Repository<AssetOrmEntity>);
      const cutoff = new Date();
      const results = await repository.findPendingDeletionBefore(cutoff, 10, { manager });

      expect(manager.createQueryBuilder).toHaveBeenCalledWith(AssetOrmEntity, 'asset');
      expect(qb.where).toHaveBeenCalledWith('asset.status = :status', { status: AssetStatus.DELETE_PENDING });
      expect(qb.andWhere).toHaveBeenCalledWith('asset.updatedAt < :cutoff', { cutoff });
      expect(qb.andWhere).toHaveBeenCalledWith(
        "(asset.metadata->>'quarantine' IS NULL OR asset.metadata->>'quarantine' = 'false')",
      );
      expect(qb.orderBy).toHaveBeenCalledWith('asset.updatedAt', 'ASC');
      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(qb.setOnLocked).toHaveBeenCalledWith('skip_locked');
      expect(update).toHaveBeenCalledWith(AssetOrmEntity, [assetId], { updatedAt: expect.any(Date) as Date });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(assetId);
      expect(results[0].status).toBe(AssetStatus.DELETE_PENDING);
    });

    it('opens a short transaction when no manager is provided and skips update when empty', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        setOnLocked: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      const transactionalManager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        update: jest.fn(),
      } as unknown as EntityManager;

      const defaultRepository = {
        manager: {
          transaction: jest.fn().mockImplementation((cb: (manager: EntityManager) => Promise<unknown>) => {
            return cb(transactionalManager);
          }),
        },
      } as unknown as Repository<AssetOrmEntity>;

      const repository = new AssetRepository(defaultRepository);
      const cutoff = new Date();
      const results = await repository.findPendingDeletionBefore(cutoff, 50);

      expect(defaultRepository.manager.transaction).toHaveBeenCalled();
      expect(transactionalManager.update).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });

  describe('findStalePendingUploadsBefore', () => {
    it('queries and claims stale pending uploads with pessimistic lock and skip locked', async () => {
      const entity = createOrmEntity();
      entity.status = AssetStatus.PENDING_UPLOAD;
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        setOnLocked: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([entity]),
      };
      const update = jest.fn().mockResolvedValue(undefined);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        update,
      } as unknown as EntityManager;

      const repository = new AssetRepository({} as unknown as Repository<AssetOrmEntity>);
      const cutoff = new Date();
      const results = await repository.findStalePendingUploadsBefore(cutoff, 25, { manager });

      expect(manager.createQueryBuilder).toHaveBeenCalledWith(AssetOrmEntity, 'asset');
      expect(qb.where).toHaveBeenCalledWith('asset.status = :status', { status: AssetStatus.PENDING_UPLOAD });
      expect(qb.andWhere).toHaveBeenCalledWith('asset.updatedAt < :cutoff', { cutoff });
      expect(qb.orderBy).toHaveBeenCalledWith('asset.updatedAt', 'ASC');
      expect(qb.limit).toHaveBeenCalledWith(25);
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(qb.setOnLocked).toHaveBeenCalledWith('skip_locked');
      expect(update).toHaveBeenCalledWith(AssetOrmEntity, [assetId], { updatedAt: expect.any(Date) as Date });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(assetId);
      expect(results[0].status).toBe(AssetStatus.PENDING_UPLOAD);
    });

    it('opens a short transaction when no manager is provided and skips update when empty', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        setOnLocked: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      const transactionalManager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        update: jest.fn(),
      } as unknown as EntityManager;

      const defaultRepository = {
        manager: {
          transaction: jest.fn().mockImplementation((cb: (manager: EntityManager) => Promise<unknown>) => {
            return cb(transactionalManager);
          }),
        },
      } as unknown as Repository<AssetOrmEntity>;

      const repository = new AssetRepository(defaultRepository);
      const cutoff = new Date();
      const results = await repository.findStalePendingUploadsBefore(cutoff, 50);

      expect(defaultRepository.manager.transaction).toHaveBeenCalled();
      expect(transactionalManager.update).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });
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
