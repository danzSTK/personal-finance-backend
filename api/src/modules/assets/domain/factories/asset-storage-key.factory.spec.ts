import { AssetPurpose } from '@/modules/assets/domain/enums';
import { AssetStorageKeyFactory } from '@/modules/assets/domain/factories/asset-storage-key.factory';

describe('AssetStorageKeyFactory', () => {
  describe('create', () => {
    it('creates the canonical user avatar key', () => {
      const assetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
      const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';

      const key = AssetStorageKeyFactory.create({ assetId, userId, purpose: AssetPurpose.USER_AVATAR });

      expect(key.value).toBe(`users/${userId}/avatars/${assetId}.webp`);
    });
  });
});
