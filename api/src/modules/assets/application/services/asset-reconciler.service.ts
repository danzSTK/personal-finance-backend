import workerConfig from '@/config/worker.config';
import { AssetFailureCode } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { IObjectStorage } from '@/shared/object-storage/contracts/object-storage.interface';
import { BeforeApplicationShutdown, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class AssetReconcilerService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(AssetReconcilerService.name);
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isDraining = false;

  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly objectStorage: IObjectStorage,
    @Inject(workerConfig.KEY)
    private readonly config: ConfigType<typeof workerConfig>,
  ) {}

  onModuleInit(): void {
    this.interval = setInterval(() => void this.reconcile(), this.config.assetReconciliation.intervalMs);
    this.interval.unref();
  }

  beforeApplicationShutdown(): void {
    this.isDraining = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async reconcile(): Promise<void> {
    if (this.isRunning || this.isDraining) {
      return;
    }

    this.isRunning = true;
    try {
      await this.reconcilePendingDeletions();
      if (!this.isDraining) {
        await this.reconcileStalePendingUploads();
      }
    } catch (error) {
      this.logger.error(
        'Failed to execute asset reconciliation cycle',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async reconcilePendingDeletions(): Promise<void> {
    const cutoff = new Date(Date.now() - this.config.assetReconciliation.deleteGracePeriodMs);
    const assets = await this.assetRepository.findPendingDeletionBefore(
      cutoff,
      this.config.assetReconciliation.batchSize,
    );

    for (const asset of assets) {
      if (this.isDraining) {
        break;
      }
      try {
        await this.objectStorage.deleteObject({
          bucket: asset.bucket,
          key: asset.storageKey,
        });
        asset.markDeleted();
        await this.assetRepository.save(asset);
        this.logger.log(`Physical asset deleted and marked DELETED. assetId=${asset.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const { attempts, quarantined } = asset.recordDeleteFailure(errorMessage);

        try {
          await this.assetRepository.save(asset);
        } catch (saveError) {
          this.logger.error(
            `Failed to persist asset delete failure retry state. assetId=${asset.id}`,
            saveError instanceof Error ? saveError.stack : String(saveError),
          );
        }

        if (quarantined) {
          this.logger.error(
            `[ASSET_DELETE_QUARANTINED] Asset reached max delete retries and was quarantined. assetId=${asset.id} attempts=${attempts} error=${errorMessage}`,
            error instanceof Error ? error.stack : undefined,
          );
        } else {
          this.logger.warn(
            `Failed to delete asset from object storage; scheduled for retry. assetId=${asset.id} attempts=${attempts} error=${errorMessage}`,
          );
        }
      }
    }
  }

  private async reconcileStalePendingUploads(): Promise<void> {
    const staleCutoff = new Date(Date.now() - this.config.assetReconciliation.stalePendingUploadMs);
    const staleAssets = await this.assetRepository.findStalePendingUploadsBefore(
      staleCutoff,
      this.config.assetReconciliation.batchSize,
    );

    for (const asset of staleAssets) {
      if (this.isDraining) {
        break;
      }

      try {
        asset.markFailed(AssetFailureCode.UPLOAD_TIMEOUT);
        await this.assetRepository.save(asset);
        this.logger.log(`Stale pending upload expired to FAILED. assetId=${asset.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to expire stale pending upload. assetId=${asset.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
