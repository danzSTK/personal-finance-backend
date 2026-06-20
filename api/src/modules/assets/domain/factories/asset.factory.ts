import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose } from '@/modules/assets/domain/enums';
import { AssetStorageKeyFactory } from '@/modules/assets/domain/factories/asset-storage-key.factory';
import { randomUUID } from 'node:crypto';

interface CreatePendingAssetInput {
  userId: string;
  purpose: AssetPurpose;
  bucket: string;
}

export class AssetFactory {
  static createPendingUpload(input: CreatePendingAssetInput): Asset {
    const assetId = randomUUID();
    const storageKey = AssetStorageKeyFactory.create({
      assetId,
      userId: input.userId,
      purpose: input.purpose,
    });

    return Asset.createPendingUpload(
      {
        ...input,
        storageKey,
      },
      assetId,
    );
  }
}
