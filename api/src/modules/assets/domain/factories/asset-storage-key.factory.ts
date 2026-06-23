import { AssetPurpose } from '@/modules/assets/domain/enums';
import { StorageKey } from '@/modules/assets/domain/value-objects';

interface CreateAssetStorageKeyInput {
  assetId: string;
  userId: string;
  purpose: AssetPurpose;
}

type StorageKeyBuilder = (input: CreateAssetStorageKeyInput) => string;

const STORAGE_KEY_BUILDERS = {
  [AssetPurpose.USER_AVATAR]: ({ assetId, userId }) => `users/${userId}/avatars/${assetId}.webp`,
} satisfies Record<AssetPurpose, StorageKeyBuilder>;

export class AssetStorageKeyFactory {
  static create(input: CreateAssetStorageKeyInput): StorageKey {
    return StorageKey.create(STORAGE_KEY_BUILDERS[input.purpose](input));
  }
}
