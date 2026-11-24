import {
  TRANSACTION_ATTACHMENT_OPTIMIZED_FORMAT,
  TRANSACTION_ATTACHMENT_OPTIMIZED_MAX_DIMENSION,
  TRANSACTION_ATTACHMENT_OPTIMIZED_MEDIA_TYPE,
  TRANSACTION_ATTACHMENT_OPTIMIZED_WEBP_QUALITY,
} from '@/common/models/constants';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AssetMapper } from '@/modules/assets/infrastructure/mappers/asset.mapper';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import {
  TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
  TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE,
  TransactionAttachmentOptimizeJobPayload,
} from '@/modules/transactions/infrastructure/queues/transaction-attachment-queue.constants';
import { IObjectStorage } from '@/shared/object-storage';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { DataSource } from 'typeorm';

@Injectable()
@Processor(TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE, { concurrency: 1 })
export class TransactionAttachmentOptimizationProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionAttachmentOptimizationProcessor.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly assetRepository: IAssetRepository,
    private readonly objectStorage: IObjectStorage,
  ) {
    super();
  }

  async process(job: Job<TransactionAttachmentOptimizeJobPayload>): Promise<void> {
    if (job.name !== TRANSACTION_ATTACHMENT_OPTIMIZE_JOB) {
      return;
    }

    const { assetId, userId } = job.data;

    // 1. Check current asset status in repository
    const asset = await this.assetRepository.findByIdAndUserId(assetId, userId);

    if (!asset || asset.status !== AssetStatus.READY) {
      this.logger.log(`Skipping optimization for asset ${assetId}: status is ${asset?.status ?? 'not found'}`);
      return;
    }

    // 2. Download original file from private bucket
    const { body } = await this.objectStorage.getObject({
      bucket: asset.bucket,
      key: asset.storageKey,
    });

    // 3. Sharp optimization: rotate by EXIF, fit inside max dimensions, encode as WebP
    const { data: optimizedBuffer, info } = await sharp(body)
      .rotate()
      .resize({
        width: TRANSACTION_ATTACHMENT_OPTIMIZED_MAX_DIMENSION,
        height: TRANSACTION_ATTACHMENT_OPTIMIZED_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: TRANSACTION_ATTACHMENT_OPTIMIZED_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    // 4. Calculate new SHA-256 checksum
    const checksum = createHash('sha256').update(optimizedBuffer).digest('hex');
    const sizeBytes = optimizedBuffer.length;

    // 5. Fast-exit check before writing to storage in case asset was deleted during Sharp processing
    const currentAsset = await this.assetRepository.findByIdAndUserId(assetId, userId);
    if (!currentAsset || currentAsset.status !== AssetStatus.READY) {
      this.logger.warn(
        `Asset ${assetId} changed status to ${currentAsset?.status ?? 'not found'} before storage overwrite. Skipping upload.`,
      );
      return;
    }

    // 6. Overwrite in private bucket on same key
    await this.objectStorage.putObject({
      bucket: asset.bucket,
      key: asset.storageKey,
      body: optimizedBuffer,
      contentType: TRANSACTION_ATTACHMENT_OPTIMIZED_MEDIA_TYPE,
      checksumSha256Hex: checksum,
    });

    // 7. Pessimistic lock check on asset before persisting updated metadata
    let shouldCompensateStorage = false;

    await this.dataSource.transaction(async manager => {
      const assetOrm = await manager.findOne(AssetOrmEntity, {
        where: { id: assetId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!assetOrm || assetOrm.status !== AssetStatus.READY) {
        this.logger.warn(
          `Asset ${assetId} changed status to ${assetOrm?.status ?? 'deleted'} while optimizing. Aborting metadata update and compensating storage object.`,
        );
        shouldCompensateStorage = true;
        return;
      }

      const domainAsset = AssetMapper.toDomain(assetOrm);
      domainAsset.applyOptimization({
        contentType: TRANSACTION_ATTACHMENT_OPTIMIZED_MEDIA_TYPE,
        sizeBytes,
        checksum,
        metadata: {
          width: info.width,
          height: info.height,
          format: TRANSACTION_ATTACHMENT_OPTIMIZED_FORMAT,
        },
      });

      await this.assetRepository.save(domainAsset, { manager });
    });

    // 8. Compensate storage overwrite if asset left READY concurrently (prevents resurrecting deleted objects)
    if (shouldCompensateStorage) {
      await this.compensateStaleStorageOverwrite(assetId, userId, asset.bucket, asset.storageKey);
      return;
    }

    this.logger.log(
      `Asset ${assetId} successfully optimized to ${TRANSACTION_ATTACHMENT_OPTIMIZED_FORMAT} (${sizeBytes} bytes).`,
    );
  }

  private async compensateStaleStorageOverwrite(
    assetId: string,
    userId: string,
    bucket: string,
    key: string,
  ): Promise<void> {
    try {
      await this.objectStorage.deleteObject({ bucket, key });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to delete stale optimized object for asset ${assetId}; scheduling reconciler retry if already DELETED. error=${errorMessage}`,
      );

      await this.dataSource.transaction(async manager => {
        const assetOrm = await manager.findOne(AssetOrmEntity, {
          where: { id: assetId, userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (assetOrm && assetOrm.status === AssetStatus.DELETED) {
          const domainAsset = AssetMapper.toDomain(assetOrm);
          domainAsset.recordDeleteFailure(`Post-optimization cleanup failed: ${errorMessage}`);
          await this.assetRepository.save(domainAsset, { manager });
        }
      });
    }
  }
}
