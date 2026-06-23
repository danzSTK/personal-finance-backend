import objectStorageConfig from '@/config/object-storage.config';
import { AssetPurpose } from '@/modules/assets/domain/enums';
import { AssetFactory } from '@/modules/assets/domain/factories';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AvatarUploadFailedError, UserNotFoundError } from '@/modules/users/application/errors';
import { IAvatarImageProcessor } from '@/modules/users/application/ports/avatar-image-processor.interface';
import { IUserCacheInvalidator } from '@/modules/users/application/ports/user-cache-invalidator.interface';
import {
  UpdateUserAvatarInput,
  UpdateUserAvatarOutput,
} from '@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.dto';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IObjectStorage, ObjectStorageError } from '@/shared/object-storage';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class UpdateUserAvatarUseCase {
  private readonly logger = new Logger(UpdateUserAvatarUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly userRepository: IUserRepository,
    private readonly assetsRepository: IAssetRepository,
    private readonly imageProcessor: IAvatarImageProcessor,
    private readonly objectStorage: IObjectStorage,
    private readonly outboxWriter: OutboxWriteService,
    private readonly userCacheInvalidator: IUserCacheInvalidator,
  ) {}

  async execute(input: UpdateUserAvatarInput): Promise<UpdateUserAvatarOutput> {
    const processed = await this.imageProcessor.process(input.bytes);
    const asset = AssetFactory.createPendingUpload({
      userId: input.userId,
      purpose: AssetPurpose.USER_AVATAR,
      bucket: this.storageConfig.publicBucketName,
    });

    await this.assetsRepository.save(asset);

    try {
      await this.objectStorage.putObject({
        bucket: asset.bucket,
        key: asset.storageKey,
        body: processed.bytes,
        contentType: processed.contentType,
        checksumSha256Hex: processed.checksum,
        metadata: {
          assetId: asset.id,
          userId: asset.userId,
          purpose: asset.purpose,
        },
      });
    } catch (error) {
      await this.recordUploadFailure(asset.id, input.userId, error);
      throw new AvatarUploadFailedError();
    }

    let updatedUser: User;

    try {
      updatedUser = await this.dataSource.transaction(async manager => {
        const user = await this.userRepository.findByIdForUpdate(input.userId, {
          manager,
        });

        if (!user) {
          throw new UserNotFoundError();
        }

        const pendingAsset = await this.assetsRepository.findByIdAndUserId(asset.id, input.userId, { manager });

        if (!pendingAsset) {
          throw new Error('Pending avatar asset was not found');
        }

        pendingAsset.markReady({
          contentType: processed.contentType,
          sizeBytes: processed.sizeBytes,
          checksum: processed.checksum,
          metadata: processed.metadata,
        });

        user.changeAvatarAsset(pendingAsset.id);

        await this.assetsRepository.save(pendingAsset, { manager });

        const savedUser = await this.userRepository.save(user, { manager });

        await this.outboxWriter.storeEvents(user.pullDomainEvents(), { manager });

        return savedUser;
      });
    } catch (error) {
      await this.compensateUploadedObject(asset.id, input.userId);
      throw error;
    }

    try {
      await this.userCacheInvalidator.invalidate(updatedUser);
    } catch (error) {
      this.logger.error(
        `Avatar updated but user cache invalidation failed userId=${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      assetId: asset.id,
      url: this.objectStorage.buildPublicUrl({
        bucket: asset.bucket,
        key: asset.storageKey,
      }),
    };
  }

  private async recordUploadFailure(assetId: string, userId: string, error: unknown): Promise<void> {
    try {
      const failedAsset = await this.assetsRepository.findByIdAndUserId(assetId, userId);

      if (!failedAsset) {
        return;
      }

      const failureCode = error instanceof ObjectStorageError ? error.code : 'OBJECT_STORAGE_UNKNOWN';
      failedAsset.markFailed(failureCode);
      await this.assetsRepository.save(failedAsset);
    } catch (persistenceError) {
      this.logger.error(
        `Could not mark avatar asset as failed assetId=${assetId}`,
        persistenceError instanceof Error ? persistenceError.stack : undefined,
      );
    }
  }

  private async compensateUploadedObject(assetId: string, userId: string): Promise<void> {
    const pendingAsset = await this.assetsRepository.findByIdAndUserId(assetId, userId);

    if (!pendingAsset) {
      return;
    }

    try {
      await this.objectStorage.deleteObject({
        bucket: pendingAsset.bucket,
        key: pendingAsset.storageKey,
      });
    } catch (error) {
      this.logger.error(
        `Could not compensate uploaded avatar assetId=${assetId}`,
        error instanceof Error ? error.stack : undefined,
      );

      return;
    }

    try {
      pendingAsset.markFailed('DATABASE_FINALIZATION_FAILED');
      await this.assetsRepository.save(pendingAsset);
    } catch (error) {
      this.logger.error(
        `Could not mark compensated avatar asset as failed assetId=${assetId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
