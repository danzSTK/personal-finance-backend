import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { InvalidAssetError } from '@/modules/assets/domain/errors';
import { AssetStorageKeyFactory } from '@/modules/assets/domain/factories';
import { AssetMapper } from '@/modules/assets/infrastructure/mappers/asset.mapper';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';

describe('AssetMapper', () => {
  const assetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';

  describe('toDomain', () => {
    it('reconstitutes storage key and bigint size', () => {
      const entity = createOrmEntity();

      const asset = AssetMapper.toDomain(entity);

      expect(asset.id).toBe(assetId);
      expect(asset.storageKey).toBe(entity.storageKey);
      expect(asset.sizeBytes).toBe(2048);
      expect(asset.status).toBe(AssetStatus.READY);
    });

    it('rejects an unsafe persisted size', () => {
      const entity = createOrmEntity();
      entity.sizeBytes = '9007199254740992';

      expect(() => AssetMapper.toDomain(entity)).toThrow(InvalidAssetError);
    });
  });

  describe('toOrm', () => {
    it('converts primitives for persistence', () => {
      const asset = createReadyAsset();

      const entity = AssetMapper.toOrm(asset);

      expect(entity).toMatchObject({
        id: assetId,
        userId,
        storageKey: `users/${userId}/avatars/${assetId}.webp`,
        sizeBytes: '2048',
        contentType: 'image/webp',
      });
    });
  });

  function createReadyAsset(): Asset {
    const asset = Asset.createPendingUpload(
      {
        userId,
        purpose: AssetPurpose.USER_AVATAR,
        bucket: 'public-assets',
        storageKey: AssetStorageKeyFactory.create({ assetId, userId, purpose: AssetPurpose.USER_AVATAR }),
      },
      assetId,
    );

    asset.markReady({
      contentType: 'image/webp',
      sizeBytes: 2048,
      checksum: 'a'.repeat(64),
      metadata: { width: 512, height: 512, format: 'webp' },
    });

    return asset;
  }

  function createOrmEntity(): AssetOrmEntity {
    return {
      id: assetId,
      userId,
      purpose: AssetPurpose.USER_AVATAR,
      status: AssetStatus.READY,
      bucket: 'public-assets',
      storageKey: `users/${userId}/avatars/${assetId}.webp`,
      contentType: 'image/webp',
      sizeBytes: '2048',
      checksum: 'a'.repeat(64),
      metadata: { width: 512, height: 512, format: 'webp' },
      failureCode: null,
      readyAt: new Date(),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: undefined as never,
    };
  }
});
