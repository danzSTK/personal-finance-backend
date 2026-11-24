import {
  TRANSACTION_ATTACHMENT_MAX_COUNT,
  TRANSACTION_ATTACHMENT_MAX_POSITION,
  TRANSACTION_ATTACHMENT_MIN_POSITION,
} from '@/common/models/constants';
import objectStorageConfig from '@/config/object-storage.config';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetFailureCode, AssetPurpose } from '@/modules/assets/domain/enums';
import { AssetFactory } from '@/modules/assets/domain/factories';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import {
  TransactionAttachmentFilesEmptyError,
  TransactionNotFoundError,
} from '@/modules/transactions/application/errors';
import {
  AddTransactionAttachmentsInput,
  AddTransactionAttachmentsOutput,
  AttachmentFileInput,
} from '@/modules/transactions/application/use-cases/add-transaction-attachments/add-transaction-attachments.dto';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import {
  TransactionAttachmentLimitExceededError,
  TransactionTypeDoesNotSupportAttachmentsError,
} from '@/modules/transactions/domain/errors';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import {
  TransactionAttachmentImageValidator,
  ValidatedAttachmentImage,
} from '@/modules/transactions/infrastructure/image-processing/transaction-attachment-image.validator';
import { TransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/transaction-attachment-job-queue-producer.port';
import { IObjectStorage, ObjectStorageError } from '@/shared/object-storage';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

interface PreparedAttachmentItem {
  file: AttachmentFileInput;
  validated: ValidatedAttachmentImage;
  checksum: string;
  asset: Asset;
  attachment: TransactionAttachment;
  uploadAttempted: boolean;
}

@Injectable()
export class AddTransactionAttachmentsUseCase {
  private readonly logger = new Logger(AddTransactionAttachmentsUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly assetRepository: IAssetRepository,
    private readonly imageValidator: TransactionAttachmentImageValidator,
    private readonly objectStorage: IObjectStorage,
    private readonly jobQueueProducer: TransactionAttachmentJobQueueProducer,
  ) {}

  async execute(input: AddTransactionAttachmentsInput): Promise<AddTransactionAttachmentsOutput> {
    if (!input.files || input.files.length === 0) {
      throw new TransactionAttachmentFilesEmptyError();
    }

    if (input.files.length > TRANSACTION_ATTACHMENT_MAX_COUNT) {
      throw new TransactionAttachmentLimitExceededError(
        `Cannot upload more than ${TRANSACTION_ATTACHMENT_MAX_COUNT} files per request.`,
      );
    }

    // 1. Synchronously validate image files and precompute SHA-256 checksums
    const validatedInputs = await Promise.all(
      input.files.map(async file => ({
        file,
        validated: await this.imageValidator.validate(file.buffer),
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
      })),
    );

    // 2. Short transaction: acquire lock, purge stale inactive links, validate limits, reserve PENDING_UPLOAD assets
    const preparedItems = await this.dataSource.transaction<PreparedAttachmentItem[]>(async manager => {
      const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
        input.transactionId,
        input.userId,
        { manager },
      );

      if (!transaction) {
        throw new TransactionNotFoundError();
      }

      if (!transaction.supportsAttachments()) {
        throw new TransactionTypeDoesNotSupportAttachmentsError();
      }

      // Release slots previously occupied by FAILED / DELETE_PENDING / DELETED assets
      await this.attachmentRepository.deleteInactiveByTransactionId(input.transactionId, { manager });

      const activeCount = await this.attachmentRepository.countActiveByTransactionId(input.transactionId, { manager });

      if (activeCount + validatedInputs.length > TRANSACTION_ATTACHMENT_MAX_COUNT) {
        throw new TransactionAttachmentLimitExceededError();
      }

      const existingAttachments = await this.attachmentRepository.findByTransactionId(input.transactionId, { manager });
      const occupiedPositions = new Set(existingAttachments.map(att => att.position));

      const availablePositions: number[] = [];
      for (let p = TRANSACTION_ATTACHMENT_MIN_POSITION; p <= TRANSACTION_ATTACHMENT_MAX_POSITION; p++) {
        if (!occupiedPositions.has(p)) {
          availablePositions.push(p);
        }
      }

      const items: PreparedAttachmentItem[] = [];

      for (let i = 0; i < validatedInputs.length; i++) {
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

        items.push({
          ...validatedInputs[i],
          asset,
          attachment,
          uploadAttempted: false,
        });
      }

      await this.attachmentRepository.saveAll(
        items.map(item => item.attachment),
        { manager },
      );

      return items;
    });

    // 3. Outside of lock: upload original files to private bucket (with batch compensation on failure)
    try {
      for (const item of preparedItems) {
        item.uploadAttempted = true;
        await this.objectStorage.putObject({
          bucket: this.storageConfig.privateBucketName,
          key: item.asset.storageKey,
          body: item.file.buffer,
          contentType: item.validated.contentType,
          checksumSha256Hex: item.checksum,
          metadata: {
            userId: input.userId,
            transactionId: input.transactionId,
            assetId: item.asset.id,
          },
        });
      }
    } catch (error) {
      await this.compensateBatchUploadFailure(input.transactionId, input.userId, preparedItems, error);
      throw error;
    }

    // 4. Short transaction: lock again and confirm assets (markReady) or discard if transaction was deleted concurrently
    await this.dataSource.transaction(async manager => {
      const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
        input.transactionId,
        input.userId,
        { manager },
      );

      if (!transaction || !transaction.supportsAttachments()) {
        await this.attachmentRepository.deleteByIds(
          preparedItems.map(item => item.attachment.id),
          { manager },
        );

        for (const item of preparedItems) {
          item.asset.discardUploadedPendingAsset(AssetFailureCode.TRANSACTION_DELETED);
          await this.assetRepository.save(item.asset, { manager });
        }

        if (!transaction) {
          throw new TransactionNotFoundError();
        }

        throw new TransactionTypeDoesNotSupportAttachmentsError();
      }

      for (const item of preparedItems) {
        item.asset.markReady({
          contentType: item.validated.contentType,
          sizeBytes: item.validated.sizeBytes,
          checksum: item.checksum,
          metadata: {
            width: item.validated.width,
            height: item.validated.height,
            format: item.validated.format,
          },
        });

        await this.assetRepository.save(item.asset, { manager });
      }
    });

    // 5. Enqueue background optimization jobs
    for (const item of preparedItems) {
      try {
        await this.jobQueueProducer.enqueueOptimizationJob({
          assetId: item.asset.id,
          userId: input.userId,
        });
      } catch (error) {
        this.logger.warn(`Failed to enqueue optimization job for asset ${item.asset.id}: ${(error as Error).message}`);
      }
    }

    // 6. Generate presigned URLs for newly created attachments
    const results: AddTransactionAttachmentsOutput = [];
    for (const item of preparedItems) {
      const signed = await this.objectStorage.buildSignedReadUrl({
        bucket: this.storageConfig.privateBucketName,
        key: item.asset.storageKey,
      });

      results.push({
        id: item.attachment.id,
        assetId: item.attachment.assetId,
        position: item.attachment.position,
        contentType: item.validated.contentType,
        sizeBytes: item.validated.sizeBytes,
        url: signed.url,
        expiresAt: signed.expiresAt,
        cacheMaxAgeSeconds: signed.cacheMaxAgeSeconds,
      });
    }

    return results;
  }

  private async compensateBatchUploadFailure(
    transactionId: string,
    userId: string,
    preparedItems: PreparedAttachmentItem[],
    uploadError: unknown,
  ): Promise<void> {
    const failureCode =
      uploadError instanceof ObjectStorageError ? uploadError.code : AssetFailureCode.STORAGE_UPLOAD_FAILED;

    try {
      await this.dataSource.transaction(async manager => {
        await this.transactionRepository.findByIdAndUserIdForUpdate(transactionId, userId, { manager });

        await this.attachmentRepository.deleteByIds(
          preparedItems.map(item => item.attachment.id),
          { manager },
        );

        for (const item of preparedItems) {
          if (item.uploadAttempted) {
            item.asset.discardUploadedPendingAsset(failureCode);
          } else {
            item.asset.markFailed(failureCode);
          }

          await this.assetRepository.save(item.asset, { manager });
        }
      });
    } catch (compensationError) {
      this.logger.error(
        `Failed to compensate batch attachment upload failure for transactionId=${transactionId}`,
        compensationError instanceof Error ? compensationError.stack : String(compensationError),
      );
    }
  }
}
