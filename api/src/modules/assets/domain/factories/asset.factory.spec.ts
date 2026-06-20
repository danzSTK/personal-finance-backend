import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { AssetFactory } from '@/modules/assets/domain/factories/asset.factory';

describe('AssetFactory', () => {
  describe('createPendingUpload', () => {
    it('creates an asset with an id-based canonical storage key', () => {
      const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';

      const asset = AssetFactory.createPendingUpload({
        userId,
        purpose: AssetPurpose.USER_AVATAR,
        bucket: 'public-assets',
      });

      expect(asset.status).toBe(AssetStatus.PENDING_UPLOAD);
      expect(asset.storageKey).toBe(`users/${userId}/avatars/${asset.id}.webp`);
    });
  });
});
