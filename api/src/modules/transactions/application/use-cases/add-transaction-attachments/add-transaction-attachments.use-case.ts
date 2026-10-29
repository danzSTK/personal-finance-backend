import { TransactionType } from '@/common/models/enums';
import objectStorageConfig from '@/config/object-storage.config';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose } from '@/modules/assets/domain/enums';
import { AssetFactory } from '@/modules/assets/domain/factories';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import {
  TransactionAttachmentLimitExceededError,
  TransactionTypeDoesNotSupportAttachmentsError,
} from '@/modules/transactions/domain/errors';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import {
  AddTransactionAttachmentsInput,
  AddTransactionAttachmentsOutput,
} from '@/modules/transactions/application/use-cases/add-transaction-attachments/add-transaction-attachments.dto';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { TransactionAttachmentImageValidator } from '@/modules/transactions/infrastructure/image-processing/transaction-attachment-image.validator';
import { TransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/transaction-attachment-job-queue-producer.port';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { IObjectStorage } from '@/shared/object-storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

@Injectable()
export class AddTransactionAttachmentsUseCase {
  private readonly logger = new Logger(AddTransactionAttachmentsUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly assetRepository: IAssetRepository,
    private readonly imageValidator: TransactionAttachmentImageValidator,
    private readonly objectStorage: IObjectStorage,
    private readonly jobQueueProducer: TransactionAttachmentJobQueueProducer,
  ) {}

  async execute(input: AddTransactionAttachmentsInput): Promise<AddTransactionAttachmentsOutput> {
    if (!input.files || input.files.length === 0) {
      return [];
    }

    if (input.files.length > 3) {
      throw new TransactionAttachmentLimitExceededError('Cannot upload more than 3 files per request.');
    }

    // 1. Synchronously validate image files
    const validatedFiles = await Promise.all(input.files.map(file => this.imageValidator.validate(file.buffer)));

    // 2. Short transaction: acquire lock, validate limits, create PENDING_UPLOAD assets and attachments
    const reservation = await this.dataSource.transaction(async manager => {
      const tx = await manager.findOne(TransactionOrmEntity, {
        where: { id: input.transactionId, user_id: input.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tx || tx.deleted_at !== null) {
        throw new TransactionNotFoundError();
      }

      if (tx.type !== TransactionType.INCOME && tx.type !== TransactionType.EXPENSE) {
        throw new TransactionTypeDoesNotSupportAttachmentsError();
      }

      const activeCount = await this.attachmentRepository.countActiveByTransactionId(input.transactionId, { manager });

      if (activeCount + input.files.length > 3) {
        throw new TransactionAttachmentLimitExceededError();
      }

      const existingAttachments = await this.attachmentRepository.findByTransactionId(input.transactionId, { manager });
      const occupiedPositions: Record<number, true> = {};
      existingAttachments.forEach(att => {
        occupiedPositions[att.position] = true;
      });

      const availablePositions: number[] = [];
      for (let p = 0; p <= 2; p++) {
        if (!occupiedPositions[p]) {
          availablePositions.push(p);
        }
      }

      const createdAssets: Asset[] = [];
      const createdAttachments: TransactionAttachment[] = [];

      for (let i = 0; i < input.files.length; i++) {
        const position = availablePositions[i];
        const asset = AssetFactory.createPendingUpload({
          userId: input.userId,
          purpose: AssetPurpose.TRANSACTION_ATTACHMENT,
          bucket: this.storageConfig.privateBucketName,
        });

        const attachment = TransactionAttachment.create({
          transactionId: input.transactionId,
          assetId: asset.id,
          position,
        });

        await this.assetRepository.save(asset, { manager });
        createdAssets.push(asset);
        createdAttachments.push(attachment);
      }

      await this.attachmentRepository.saveAll(createdAttachments, { manager });

      return {
        assets: createdAssets,
        attachments: createdAttachments,
      };
    });

    // 3. Outside of lock: upload original files to private bucket
    const fileChecksums: string[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const asset = reservation.assets[i];
      const validated = validatedFiles[i];
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      fileChecksums.push(checksum);

      await this.objectStorage.putObject({
        bucket: this.storageConfig.privateBucketName,
        key: asset.storageKey,
        body: file.buffer,
        contentType: validated.contentType,
        checksumSha256Hex: checksum,
        metadata: {
          userId: input.userId,
          transactionId: input.transactionId,
          assetId: asset.id,
        },
      });
    }

    // 4. Short transaction: lock again and confirm assets (markReady) or handle deletion race
    await this.dataSource.transaction(async manager => {
      const tx = await manager.findOne(TransactionOrmEntity, {
        where: { id: input.transactionId, user_id: input.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tx || tx.deleted_at !== null) {
        for (const asset of reservation.assets) {
          asset.markFailed('TRANSACTION_DELETED');
          asset.markDeletePending();
          await this.assetRepository.save(asset, { manager });
        }
        throw new TransactionNotFoundError();
      }

      for (let i = 0; i < reservation.assets.length; i++) {
        const asset = reservation.assets[i];
        const validated = validatedFiles[i];
        const checksum = fileChecksums[i];

        asset.markReady({
          contentType: validated.contentType,
          sizeBytes: validated.sizeBytes,
          checksum,
          metadata: {
            width: validated.width,
            height: validated.height,
            format: validated.format,
          },
        });

        await this.assetRepository.save(asset, { manager });
      }
    });

    // 5. Enqueue background optimization jobs
    for (const asset of reservation.assets) {
      try {
        await this.jobQueueProducer.enqueueOptimizationJob({
          assetId: asset.id,
          userId: input.userId,
        });
      } catch (error) {
        this.logger.warn(`Failed to enqueue optimization job for asset ${asset.id}: ${(error as Error).message}`);
      }
    }

    // 6. Generate presigned URLs for newly created attachments
    const results: AddTransactionAttachmentsOutput = [];
    for (let i = 0; i < reservation.attachments.length; i++) {
      const attachment = reservation.attachments[i];
      const asset = reservation.assets[i];
      const validated = validatedFiles[i];

      const signed = await this.objectStorage.buildSignedReadUrl({
        bucket: this.storageConfig.privateBucketName,
        key: asset.storageKey,
      });

      results.push({
        id: attachment.id,
        assetId: attachment.assetId,
        position: attachment.position,
        contentType: validated.contentType,
        sizeBytes: validated.sizeBytes,
        url: signed.url,
        expiresAt: signed.expiresAt,
        cacheMaxAgeSeconds: signed.cacheMaxAgeSeconds,
      });
    }

    return results;
  }
}
