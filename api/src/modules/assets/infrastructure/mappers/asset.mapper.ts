import { Asset, AssetMetadata } from '@/modules/assets/domain/entities/asset.entity';
import { InvalidAssetError } from '@/modules/assets/domain/errors';
import { StorageKey } from '@/modules/assets/domain/value-objects';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';

export class AssetMapper {
  static toDomain(entity: AssetOrmEntity): Asset {
    return Asset.reconstitute(
      {
        userId: entity.userId,
        purpose: entity.purpose,
        status: entity.status,
        bucket: entity.bucket,
        storageKey: StorageKey.reconstitute(entity.storageKey),
        contentType: entity.contentType,
        sizeBytes: AssetMapper.toDomainSize(entity.sizeBytes),
        checksum: entity.checksum,
        metadata: entity.metadata as AssetMetadata,
        failureCode: entity.failureCode,
        readyAt: entity.readyAt,
        deletedAt: entity.deletedAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      entity.id,
    );
  }

  static toOrm(asset: Asset): Partial<AssetOrmEntity> {
    return {
      id: asset.id,
      userId: asset.userId,
      purpose: asset.purpose,
      status: asset.status,
      bucket: asset.bucket,
      storageKey: asset.storageKey,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes === null ? null : String(asset.sizeBytes),
      checksum: asset.checksum,
      metadata: { ...asset.metadata },
      failureCode: asset.failureCode,
      readyAt: asset.readyAt,
      deletedAt: asset.deletedAt,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private static toDomainSize(sizeBytes: string | null): number | null {
    if (sizeBytes === null) {
      return null;
    }

    const parsed = Number(sizeBytes);

    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new InvalidAssetError('Persisted asset size is invalid.');
    }

    return parsed;
  }
}
