import { DeleteAvatarAssetInput } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.dto';
import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { IObjectStorage } from '@/shared/object-storage';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeleteAvatarAssetUseCase {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly objectStorage: IObjectStorage,
  ) {}

  async execute(input: DeleteAvatarAssetInput): Promise<void> {
    const asset = await this.assetRepository.findByIdAndUserId(input.assetId, input.userId);

    if (!asset || asset.status === AssetStatus.DELETED) {
      return;
    }

    if (asset.purpose !== AssetPurpose.USER_AVATAR) {
      throw new Error(`Asset ${asset.id} is not a user avatar.`);
    }

    if (asset.status !== AssetStatus.DELETE_PENDING) {
      asset.markDeletePending();
      await this.assetRepository.save(asset);
    }

    await this.objectStorage.deleteObject({
      bucket: asset.bucket,
      key: asset.storageKey,
    });

    asset.markDeleted();
    await this.assetRepository.save(asset);
  }
}
