import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetFailureCode, AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
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

      asset.markFailed(AssetFailureCode.STORAGE_UPLOAD_FAILED);
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
      asset.recordDeleteFailure('Temporary S3 timeout');

      expect(asset.metadata.delete_attempts).toBe(1);
      expect(asset.metadata.last_delete_error).toBe('Temporary S3 timeout');
      expect(asset.metadata.quarantine).toBe(false);

      asset.markDeleted();

      expect(asset.status).toBe(AssetStatus.DELETED);
      expect(asset.metadata).toEqual({ width: 512, height: 512, format: 'webp' });
    });

    it('rejects recordDeleteFailure when asset is not in DELETE_PENDING status', () => {
      const asset = createPendingAsset();

      expect(() => asset.recordDeleteFailure('Error')).toThrow(InvalidAssetStateTransitionError);
    });

    it('records consecutive delete failures and marks quarantine when reaching ASSET_MAX_DELETE_ATTEMPTS (5)', () => {
      const asset = createPendingAsset();
      asset.markFailed(AssetFailureCode.STORAGE_UPLOAD_FAILED);
      asset.markDeletePending();

      for (let i = 1; i <= 4; i++) {
        const result = asset.recordDeleteFailure(`Timeout ${i}`);
        expect(result).toEqual({ attempts: i, quarantined: false });
        expect(asset.metadata.delete_attempts).toBe(i);
        expect(asset.metadata.quarantine).toBe(false);
      }

      const fifthResult = asset.recordDeleteFailure('Timeout 5');
      expect(fifthResult).toEqual({ attempts: 5, quarantined: true });
      expect(asset.metadata.delete_attempts).toBe(5);
      expect(asset.metadata.quarantine).toBe(true);
      expect(asset.status).toBe(AssetStatus.DELETE_PENDING);
    });

    it('reverts DELETED status to DELETE_PENDING and increments delete_attempts when recordDeleteFailure is called on DELETED', () => {
      const asset = createPendingAsset();
      asset.markFailed(AssetFailureCode.STORAGE_UPLOAD_FAILED);
      asset.markDeletePending();

      asset.recordDeleteFailure('Initial failure 1');
      expect(asset.metadata.delete_attempts).toBe(1);

      asset.markDeleted();
      expect(asset.status).toBe(AssetStatus.DELETED);
      expect(asset.deletedAt).toBeInstanceOf(Date);
      expect(asset.metadata.delete_attempts).toBeUndefined();

      const result = asset.recordDeleteFailure('Database connection reset during save');

      expect(result).toEqual({ attempts: 2, quarantined: false });
      expect(asset.status).toBe(AssetStatus.DELETE_PENDING);
      expect(asset.deletedAt).toBeNull();
      expect(asset.metadata.delete_attempts).toBe(2);
      expect(asset.metadata.last_delete_error).toBe('Database connection reset during save');
      expect(asset.metadata.quarantine).toBe(false);
    });

    it('uses fallback error message if empty message is provided in recordDeleteFailure', () => {
      const asset = createPendingAsset();
      asset.markFailed(AssetFailureCode.STORAGE_UPLOAD_FAILED);
      asset.markDeletePending();

      asset.recordDeleteFailure('   ');
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
