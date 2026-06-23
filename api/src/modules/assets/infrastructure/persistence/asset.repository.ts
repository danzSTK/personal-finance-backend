import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AssetMapper } from '@/modules/assets/infrastructure/mappers/asset.mapper';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
}
