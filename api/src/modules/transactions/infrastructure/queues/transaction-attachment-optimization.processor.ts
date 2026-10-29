import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
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

    // 3. Sharp optimization: rotate by EXIF, fit inside 2560x2560, webp q80
    const optimizedBuffer = await sharp(body)
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    // 4. Calculate new SHA-256 and metadata
    const checksum = createHash('sha256').update(optimizedBuffer).digest('hex');
    const metadata = await sharp(optimizedBuffer).metadata();
    const sizeBytes = optimizedBuffer.length;

    // 5. Overwrite in private bucket on same key
    await this.objectStorage.putObject({
      bucket: asset.bucket,
      key: asset.storageKey,
      body: optimizedBuffer,
      contentType: 'image/webp',
      checksumSha256Hex: checksum,
    });

    // 6. Pessimistic lock check on asset before persisting updated metadata
    await this.dataSource.transaction(async manager => {
      const assetOrm = await manager.findOne(AssetOrmEntity, {
        where: { id: assetId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!assetOrm || assetOrm.status !== AssetStatus.READY) {
        this.logger.warn(
          `Asset ${assetId} changed status to ${assetOrm?.status ?? 'deleted'} while optimizing. Aborting metadata update.`,
        );
        return;
      }

      assetOrm.contentType = 'image/webp';
      assetOrm.sizeBytes = String(sizeBytes);
      assetOrm.checksum = checksum;
      assetOrm.metadata = {
        ...(assetOrm.metadata ?? {}),
        width: metadata.width,
        height: metadata.height,
        format: 'webp',
      };
      assetOrm.updatedAt = new Date();

      await manager.save(AssetOrmEntity, assetOrm);
    });

    this.logger.log(`Asset ${assetId} successfully optimized to webp (${sizeBytes} bytes).`);
  }
}
