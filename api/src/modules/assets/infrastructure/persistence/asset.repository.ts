import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AssetMapper } from '@/modules/assets/infrastructure/mappers/asset.mapper';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
@Injectable()
export class AssetRepository implements IAssetRepository {
  constructor(
    @InjectRepository(AssetOrmEntity)
    private readonly assetRepository: Repository<AssetOrmEntity>,
  ) {}

  async findByIdAndUserId(assetId: string, userId: string, options?: IRepositoryOptions): Promise<Asset | null> {
    const repository = options?.manager ? options.manager.getRepository(AssetOrmEntity) : this.assetRepository;
    const asset = await repository.findOne({
      where: {
        id: assetId,
        userId,
      },
    });

    return asset ? AssetMapper.toDomain(asset) : null;
  }

  async save(asset: Asset, options?: IRepositoryOptions): Promise<Asset> {
    const repository = options?.manager ? options.manager.getRepository(AssetOrmEntity) : this.assetRepository;
    const saved = await repository.save(AssetMapper.toOrm(asset));

    return AssetMapper.toDomain(saved);
  }

  async findPendingDeletionBefore(cutoff: Date, limit: number, options?: IRepositoryOptions): Promise<Asset[]> {
    const execute = async (manager: EntityManager): Promise<Asset[]> => {
      const entities = await manager
        .createQueryBuilder(AssetOrmEntity, 'asset')
        .where('asset.status = :status', { status: AssetStatus.DELETE_PENDING })
        .andWhere('asset.updatedAt < :cutoff', { cutoff })
        .andWhere("(asset.metadata->>'quarantine' IS NULL OR asset.metadata->>'quarantine' = 'false')")
        .orderBy('asset.updatedAt', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (entities.length === 0) {
        return [];
      }

      const now = new Date();
      const ids = entities.map(entity => entity.id);
      await manager.update(AssetOrmEntity, ids, { updatedAt: now });

      for (const entity of entities) {
        entity.updatedAt = now;
      }

      return entities.map(entity => AssetMapper.toDomain(entity));
    };

    if (options?.manager) {
      return execute(options.manager);
    }

    return this.assetRepository.manager.transaction(execute);
  }

  async findStalePendingUploadsBefore(cutoff: Date, limit: number, options?: IRepositoryOptions): Promise<Asset[]> {
    const execute = async (manager: EntityManager): Promise<Asset[]> => {
      const entities = await manager
        .createQueryBuilder(AssetOrmEntity, 'asset')
        .where('asset.status = :status', { status: AssetStatus.PENDING_UPLOAD })
        .andWhere('asset.updatedAt < :cutoff', { cutoff })
        .orderBy('asset.updatedAt', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
      if (entities.length === 0) {
        return [];
      }

      const now = new Date();
      const ids = entities.map(entity => entity.id);
      await manager.update(AssetOrmEntity, ids, { updatedAt: now });

      for (const entity of entities) {
        entity.updatedAt = now;
      }

      return entities.map(entity => AssetMapper.toDomain(entity));
    };
    if (options?.manager) {
      return execute(options.manager);
    }

    return this.assetRepository.manager.transaction(execute);
  }
}
