/* eslint-disable @typescript-eslint/unbound-method */
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { TransactionAttachmentOptimizationProcessor } from '@/modules/transactions/infrastructure/queues/transaction-attachment-optimization.processor';
import {
  TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
  TransactionAttachmentOptimizeJobPayload,
} from '@/modules/transactions/infrastructure/queues/transaction-attachment-queue.constants';
import { IObjectStorage } from '@/shared/object-storage';
import { Job } from 'bullmq';
import { DataSource, EntityManager } from 'typeorm';

jest.mock('sharp', () => {
  return jest.fn();
});

import sharp from 'sharp';

describe('TransactionAttachmentOptimizationProcessor', () => {
  const assetId = '11111111-1111-4111-a111-111111111111';
  const userId = '22222222-2222-4222-a222-222222222222';
  const storageKey = `users/${userId}/transaction-attachments/${assetId}`;

  let processor: TransactionAttachmentOptimizationProcessor;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let assetRepository: jest.Mocked<IAssetRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;

  const createOrmAsset = (status: AssetStatus): AssetOrmEntity => {
    const orm = new AssetOrmEntity();
    orm.id = assetId;
    orm.userId = userId;
    orm.purpose = AssetPurpose.TRANSACTION_ATTACHMENT;
    orm.status = status;
    orm.bucket = 'private-bucket';
    orm.storageKey = storageKey;
    orm.contentType = 'image/png';
    orm.sizeBytes = '4096';
    orm.checksum = 'a'.repeat(64);
    orm.metadata = { width: 3000, height: 2000, format: 'png' };
    orm.failureCode = null;
    orm.readyAt = new Date();
    orm.deletedAt = status === AssetStatus.DELETED ? new Date() : null;
    orm.createdAt = new Date();
    orm.updatedAt = new Date();
    return orm;
  };

  const mockSharpOptimization = (optimizedBuffer: Buffer, width = 2560, height = 1440): void => {
    const sharpMockInstance = {
      rotate: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue({
        data: optimizedBuffer,
        info: { width, height, format: 'webp', size: optimizedBuffer.length },
      }),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(sharpMockInstance);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    manager = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as jest.Mocked<DataSource>;

    assetRepository = {
      findByIdAndUserId: jest.fn(),
      save: jest.fn().mockImplementation(asset => Promise.resolve(asset)),
      findPendingDeletionBefore: jest.fn(),
      findStalePendingUploadsBefore: jest.fn(),
    } as unknown as jest.Mocked<IAssetRepository>;

    objectStorage = {
      putObject: jest.fn().mockResolvedValue({ etag: 'etag', versionId: null }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      headObject: jest.fn(),
      buildPublicUrl: jest.fn(),
      buildSignedReadUrl: jest.fn(),
      getObject: jest.fn(),
    } as unknown as jest.Mocked<IObjectStorage>;

    processor = new TransactionAttachmentOptimizationProcessor(dataSource, assetRepository, objectStorage);
  });

  it('ignores unsupported job names', async () => {
    const job = {
      name: 'unsupported-job',
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    await processor.process(job);

    expect(assetRepository.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it('skips optimization if asset is not in READY status initially', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    assetRepository.findByIdAndUserId.mockResolvedValue({
      id: assetId,
      status: AssetStatus.DELETE_PENDING,
    } as unknown as Asset);

    await processor.process(job);

    expect(objectStorage.getObject).not.toHaveBeenCalled();
    expect(objectStorage.putObject).not.toHaveBeenCalled();
  });

  it('skips storage overwrite if asset leaves READY status during Sharp processing', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    assetRepository.findByIdAndUserId
      .mockResolvedValueOnce({
        id: assetId,
        status: AssetStatus.READY,
        bucket: 'private-bucket',
        storageKey,
      } as unknown as Asset)
      .mockResolvedValueOnce({
        id: assetId,
        status: AssetStatus.DELETED,
        bucket: 'private-bucket',
        storageKey,
      } as unknown as Asset);

    objectStorage.getObject.mockResolvedValue({
      body: Buffer.from('original raw image'),
      contentType: 'image/png',
    });

    mockSharpOptimization(Buffer.from('optimized webp bytes'));

    await processor.process(job);

    expect(objectStorage.putObject).not.toHaveBeenCalled();
    expect(assetRepository.save).not.toHaveBeenCalled();
  });

  it('successfully optimizes image and updates asset metadata via domain entity', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    const mockAsset = {
      id: assetId,
      status: AssetStatus.READY,
      bucket: 'private-bucket',
      storageKey,
    } as unknown as Asset;

    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);
    objectStorage.getObject.mockResolvedValue({
      body: Buffer.from('original raw image'),
      contentType: 'image/png',
    });

    const optimizedBuffer = Buffer.from('optimized webp bytes');
    mockSharpOptimization(optimizedBuffer, 2560, 1440);
    manager.findOne.mockResolvedValue(createOrmAsset(AssetStatus.READY));

    await processor.process(job);

    expect(objectStorage.putObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: storageKey,
      body: optimizedBuffer,
      contentType: 'image/webp',
      checksumSha256Hex: expect.any(String) as string,
    });
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();
    expect(assetRepository.save).toHaveBeenCalledTimes(1);
    const [savedAsset, saveOptions] = assetRepository.save.mock.calls[0];
    expect(saveOptions).toEqual({ manager });
    expect(savedAsset.id).toBe(assetId);
    expect(savedAsset.status).toBe(AssetStatus.READY);
    expect(savedAsset.contentType).toBe('image/webp');
    expect(savedAsset.sizeBytes).toBe(optimizedBuffer.length);
    expect(savedAsset.metadata).toEqual(
      expect.objectContaining({
        width: 2560,
        height: 1440,
        format: 'webp',
      }),
    );
  });

  it('compensates by deleting storage object if asset changed away from READY after putObject', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    const mockAsset = {
      id: assetId,
      status: AssetStatus.READY,
      bucket: 'private-bucket',
      storageKey,
    } as unknown as Asset;

    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);
    objectStorage.getObject.mockResolvedValue({
      body: Buffer.from('original raw image'),
      contentType: 'image/png',
    });

    mockSharpOptimization(Buffer.from('optimized webp bytes'), 1000, 1000);
    manager.findOne.mockResolvedValue(createOrmAsset(AssetStatus.DELETED));

    await processor.process(job);

    expect(assetRepository.save).not.toHaveBeenCalled();
    expect(objectStorage.deleteObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: storageKey,
    });
  });

  it('reverts DELETED asset to DELETE_PENDING when compensating deleteObject fails', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    const mockAsset = {
      id: assetId,
      status: AssetStatus.READY,
      bucket: 'private-bucket',
      storageKey,
    } as unknown as Asset;

    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);
    objectStorage.getObject.mockResolvedValue({
      body: Buffer.from('original raw image'),
      contentType: 'image/png',
    });

    mockSharpOptimization(Buffer.from('optimized webp bytes'), 1000, 1000);
    manager.findOne
      .mockResolvedValueOnce(createOrmAsset(AssetStatus.DELETED))
      .mockResolvedValueOnce(createOrmAsset(AssetStatus.DELETED));
    objectStorage.deleteObject.mockRejectedValueOnce(new Error('R2 unavailable'));

    await processor.process(job);

    expect(assetRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: assetId,
        status: AssetStatus.DELETE_PENDING,
        deletedAt: null,
      }),
      { manager },
    );
  });
});
