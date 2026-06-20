import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { InvalidAssetStateTransitionError } from '@/modules/assets/domain/errors';
import { AssetStorageKeyFactory } from '@/modules/assets/domain/factories';

describe('Asset', () => {
  const assetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  const storageKey = `users/${userId}/avatars/${assetId}.webp`;

  describe('createPendingUpload', () => {
    it('creates a pending user avatar with the canonical storage key', () => {
      const asset = createPendingAsset();

      expect(asset.status).toBe(AssetStatus.PENDING_UPLOAD);
      expect(asset.storageKey).toBe(storageKey);
      expect(asset.contentType).toBeNull();
      expect(asset.failureCode).toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('marks a pending asset as ready with processed metadata', () => {
      const asset = createPendingAsset();

      asset.markReady({
        contentType: 'image/webp',
        sizeBytes: 1024,
        checksum: 'a'.repeat(64),
        metadata: { width: 512, height: 512, format: 'webp' },
      });

      expect(asset.status).toBe(AssetStatus.READY);
      expect(asset.readyAt).toBeInstanceOf(Date);
      expect(asset.metadata).toEqual({ width: 512, height: 512, format: 'webp' });
    });

    it('rejects deleting an asset before it is ready or failed', () => {
      const asset = createPendingAsset();

      expect(() => asset.markDeletePending()).toThrow(InvalidAssetStateTransitionError);
    });

    it('moves a failed upload through pending deletion to deleted', () => {
      const asset = createPendingAsset();

      asset.markFailed('STORAGE_UPLOAD_FAILED');
      asset.markDeletePending();
      asset.markDeleted();

      expect(asset.status).toBe(AssetStatus.DELETED);
      expect(asset.failureCode).toBeNull();
      expect(asset.deletedAt).toBeInstanceOf(Date);
    });
  });

  function createPendingAsset(): Asset {
    return Asset.createPendingUpload(
      {
        userId,
        purpose: AssetPurpose.USER_AVATAR,
        bucket: 'public-assets',
        storageKey: AssetStorageKeyFactory.create({ assetId, userId, purpose: AssetPurpose.USER_AVATAR }),
      },
      assetId,
    );
  }
});
