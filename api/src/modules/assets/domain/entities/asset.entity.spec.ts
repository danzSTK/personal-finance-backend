import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { InvalidAssetError, InvalidAssetStateTransitionError } from '@/modules/assets/domain/errors';
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

    it('cleans operational deletion metadata on markDeleted while preserving technical metadata', () => {
      const asset = createPendingAsset();
      asset.markReady({
        contentType: 'image/webp',
        sizeBytes: 1024,
        checksum: 'a'.repeat(64),
        metadata: { width: 512, height: 512, format: 'webp' },
      });
      asset.markDeletePending();
      asset.recordDeleteFailure('Temporary S3 timeout', 5);

      expect(asset.metadata.delete_attempts).toBe(1);
      expect(asset.metadata.last_delete_error).toBe('Temporary S3 timeout');
      expect(asset.metadata.quarantine).toBe(false);

      asset.markDeleted();

      expect(asset.status).toBe(AssetStatus.DELETED);
      expect(asset.metadata).toEqual({ width: 512, height: 512, format: 'webp' });
    });

    it('rejects recordDeleteFailure when asset is not in DELETE_PENDING status', () => {
      const asset = createPendingAsset();

      expect(() => asset.recordDeleteFailure('Error', 5)).toThrow(InvalidAssetStateTransitionError);
    });

    it('rejects recordDeleteFailure when maxRetries is not a positive safe integer', () => {
      const asset = createPendingAsset();
      asset.markFailed('UPLOAD_FAILED');
      asset.markDeletePending();

      expect(() => asset.recordDeleteFailure('Error', 0)).toThrow(InvalidAssetError);
      expect(() => asset.recordDeleteFailure('Error', -1)).toThrow(InvalidAssetError);
      expect(() => asset.recordDeleteFailure('Error', 1.5)).toThrow(InvalidAssetError);
    });

    it('records consecutive delete failures and marks quarantine when reaching maxRetries', () => {
      const asset = createPendingAsset();
      asset.markFailed('UPLOAD_FAILED');
      asset.markDeletePending();

      const firstResult = asset.recordDeleteFailure('Timeout 1', 3);
      expect(firstResult).toEqual({ attempts: 1, quarantined: false });
      expect(asset.metadata.delete_attempts).toBe(1);
      expect(asset.metadata.last_delete_error).toBe('Timeout 1');
      expect(asset.metadata.last_delete_attempt_at).toBeDefined();
      expect(asset.metadata.quarantine).toBe(false);

      const secondResult = asset.recordDeleteFailure('Timeout 2', 3);
      expect(secondResult).toEqual({ attempts: 2, quarantined: false });
      expect(asset.metadata.delete_attempts).toBe(2);
      expect(asset.metadata.quarantine).toBe(false);

      const thirdResult = asset.recordDeleteFailure('Timeout 3', 3);
      expect(thirdResult).toEqual({ attempts: 3, quarantined: true });
      expect(asset.metadata.delete_attempts).toBe(3);
      expect(asset.metadata.quarantine).toBe(true);
      expect(asset.status).toBe(AssetStatus.DELETE_PENDING);
    });

    it('uses fallback error message if empty message is provided in recordDeleteFailure', () => {
      const asset = createPendingAsset();
      asset.markFailed('UPLOAD_FAILED');
      asset.markDeletePending();

      asset.recordDeleteFailure('   ', 5);
      expect(asset.metadata.last_delete_error).toBe('Unknown error');
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
