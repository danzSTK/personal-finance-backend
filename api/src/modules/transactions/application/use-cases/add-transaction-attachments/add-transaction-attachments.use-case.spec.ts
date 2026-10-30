/* eslint-disable @typescript-eslint/unbound-method */
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import objectStorageConfig from '@/config/object-storage.config';
import { TransactionType } from '@/common/models/enums';
import type { ConfigType } from '@nestjs/config';
import {
  TransactionAttachmentLimitExceededError,
  TransactionTypeDoesNotSupportAttachmentsError,
} from '@/modules/transactions/domain/errors';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { AddTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/add-transaction-attachments/add-transaction-attachments.use-case';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { TransactionAttachmentImageValidator } from '@/modules/transactions/infrastructure/image-processing/transaction-attachment-image.validator';
import { TransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/transaction-attachment-job-queue-producer.port';
import { IObjectStorage } from '@/shared/object-storage';
import { DataSource, EntityManager } from 'typeorm';

describe('AddTransactionAttachmentsUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';
  const storageConfig = {
    privateBucketName: 'private-bucket',
    publicBucketName: 'public-bucket',
  } as unknown as ConfigType<typeof objectStorageConfig>;

  let useCase: AddTransactionAttachmentsUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;
  let assetRepository: jest.Mocked<IAssetRepository>;
  let imageValidator: jest.Mocked<TransactionAttachmentImageValidator>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let jobQueueProducer: jest.Mocked<TransactionAttachmentJobQueueProducer>;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as jest.Mocked<DataSource>;

    attachmentRepository = {
      findByTransactionId: jest.fn().mockResolvedValue([]),
      findByIdAndTransactionId: jest.fn(),
      findReadyByTransactionId: jest.fn(),
      countActiveByTransactionId: jest.fn().mockResolvedValue(0),
      countActiveByTransactionIds: jest.fn(),
      save: jest.fn(),
      saveAll: jest.fn().mockImplementation(items => Promise.resolve(items)),
      delete: jest.fn(),
      reorderPositions: jest.fn(),
    } as unknown as jest.Mocked<ITransactionAttachmentRepository>;

    assetRepository = {
      findByIdAndUserId: jest.fn(),
      save: jest.fn().mockImplementation(asset => Promise.resolve(asset)),
      findPendingDeletionBefore: jest.fn(),
      findStalePendingUploadsBefore: jest.fn(),
    } as unknown as jest.Mocked<IAssetRepository>;

    imageValidator = {
      validate: jest.fn().mockResolvedValue({
        contentType: 'image/webp',
        width: 1920,
        height: 1080,
        format: 'webp',
        sizeBytes: 2048,
      }),
    } as unknown as jest.Mocked<TransactionAttachmentImageValidator>;

    objectStorage = {
      putObject: jest.fn().mockResolvedValue({ etag: 'etag', versionId: null }),
      deleteObject: jest.fn(),
      headObject: jest.fn(),
      buildPublicUrl: jest.fn(),
      buildSignedReadUrl: jest.fn().mockResolvedValue({
        url: 'https://signed.r2.cloudflarestorage.com/file',
        expiresAt: new Date(Date.now() + 300 * 1000),
        cacheMaxAgeSeconds: 240,
      }),
      getObject: jest.fn(),
    } as unknown as jest.Mocked<IObjectStorage>;

    jobQueueProducer = {
      enqueueOptimizationJob: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionAttachmentJobQueueProducer>;

    useCase = new AddTransactionAttachmentsUseCase(
      dataSource,
      storageConfig,
      attachmentRepository,
      assetRepository,
      imageValidator,
      objectStorage,
      jobQueueProducer,
    );
  });

  it('returns empty array when no files are provided', async () => {
    const result = await useCase.execute({
      userId,
      transactionId,
      files: [],
    });

    expect(result).toEqual([]);
  });

  it('rejects more than 3 files', async () => {
    const files = [
      { buffer: Buffer.from('1'), originalname: '1.jpg' },
      { buffer: Buffer.from('2'), originalname: '2.jpg' },
      { buffer: Buffer.from('3'), originalname: '3.jpg' },
      { buffer: Buffer.from('4'), originalname: '4.jpg' },
    ];

    await expect(
      useCase.execute({
        userId,
        transactionId,
        files,
      }),
    ).rejects.toThrow(TransactionAttachmentLimitExceededError);
  });

  it('rejects when transaction does not exist', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        files: [{ buffer: Buffer.from('1'), originalname: '1.jpg' }],
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('rejects when transaction is a TRANSFER', async () => {
    manager.findOne.mockResolvedValue({
      id: transactionId,
      user_id: userId,
      type: TransactionType.TRANSFER,
      deleted_at: null,
    });

    await expect(
      useCase.execute({
        userId,
        transactionId,
        files: [{ buffer: Buffer.from('1'), originalname: '1.jpg' }],
      }),
    ).rejects.toThrow(TransactionTypeDoesNotSupportAttachmentsError);
  });

  it('rejects when active count plus incoming files exceeds 3', async () => {
    manager.findOne.mockResolvedValue({
      id: transactionId,
      user_id: userId,
      type: TransactionType.EXPENSE,
      deleted_at: null,
    });
    attachmentRepository.countActiveByTransactionId.mockResolvedValue(2);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        files: [
          { buffer: Buffer.from('1'), originalname: '1.jpg' },
          { buffer: Buffer.from('2'), originalname: '2.jpg' },
        ],
      }),
    ).rejects.toThrow(TransactionAttachmentLimitExceededError);
  });

  it('successfully uploads attachments and returns signed urls', async () => {
    manager.findOne.mockResolvedValue({
      id: transactionId,
      user_id: userId,
      type: TransactionType.EXPENSE,
      deleted_at: null,
    });
    attachmentRepository.countActiveByTransactionId.mockResolvedValue(0);

    const result = await useCase.execute({
      userId,
      transactionId,
      files: [{ buffer: Buffer.from('image bytes'), originalname: 'receipt.png' }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].position).toBe(0);
    expect(result[0].url).toBe('https://signed.r2.cloudflarestorage.com/file');
    expect(result[0].cacheMaxAgeSeconds).toBe(240);
    expect(objectStorage.putObject).toHaveBeenCalledTimes(1);
    expect(jobQueueProducer.enqueueOptimizationJob).toHaveBeenCalledTimes(1);
  });
});
