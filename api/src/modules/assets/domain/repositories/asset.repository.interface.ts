import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';

export abstract class IAssetRepository {
  abstract findByIdAndUserId(assetId: string, userId: string, options?: IRepositoryOptions): Promise<Asset | null>;

  abstract save(asset: Asset, options?: IRepositoryOptions): Promise<Asset>;
}
