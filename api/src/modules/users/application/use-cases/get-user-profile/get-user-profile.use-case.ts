import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import {
  GetUserProfileInput,
  GetUserProfileOutput,
} from '@/modules/users/application/use-cases/get-user-profile/get-user-profile.dto';
import { IObjectStorage } from '@/shared/object-storage';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetUserProfileUseCase {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly objectStorage: IObjectStorage,
  ) {}

  async execute(input: GetUserProfileInput): Promise<GetUserProfileOutput> {
    const avatarUrl = await this.resolveAvatarUrl(input);

    return {
      user: input.user,
      avatarUrl,
    };
  }

  private async resolveAvatarUrl(input: GetUserProfileInput): Promise<string | null> {
    const avatarAssetId = input.user.avatarAssetId;

    if (!avatarAssetId) {
      return null;
    }

    const asset = await this.assetRepository.findByIdAndUserId(avatarAssetId, input.user.id);

    if (!asset || asset.status !== AssetStatus.READY) {
      return null;
    }

    return this.objectStorage.buildPublicUrl({
      bucket: asset.bucket,
      key: asset.storageKey,
    });
  }
}
