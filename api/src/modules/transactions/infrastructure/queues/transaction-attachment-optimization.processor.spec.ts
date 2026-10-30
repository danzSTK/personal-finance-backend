/* eslint-disable @typescript-eslint/unbound-method */
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
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

  let processor: TransactionAttachmentOptimizationProcessor;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let assetRepository: jest.Mocked<IAssetRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;

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
      save: jest.fn(),
      findPendingDeletionBefore: jest.fn(),
      findStalePendingUploadsBefore: jest.fn(),
    } as unknown as jest.Mocked<IAssetRepository>;

    objectStorage = {
      putObject: jest.fn(),
      deleteObject: jest.fn(),
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

  it('skips optimization if asset is not in READY status', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    const mockAsset = {
      id: assetId,
      status: AssetStatus.DELETE_PENDING,
    } as unknown as Asset;

    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);

    await processor.process(job);

    expect(objectStorage.getObject).not.toHaveBeenCalled();
    expect(objectStorage.putObject).not.toHaveBeenCalled();
  });

  it('successfully optimizes image and updates asset metadata in database', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    const mockAsset = {
      id: assetId,
      status: AssetStatus.READY,
      bucket: 'private-bucket',
      storageKey: 'users/u/transaction-attachments/asset-1',
    } as unknown as Asset;

    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);
    objectStorage.getObject.mockResolvedValue({
      body: Buffer.from('original raw image'),
      contentType: 'image/png',
    });

    const optimizedBuffer = Buffer.from('optimized webp bytes');
    const sharpMockInstance = {
      rotate: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(optimizedBuffer),
      metadata: jest.fn().mockResolvedValue({ width: 2560, height: 1440, format: 'webp' }),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(sharpMockInstance);

    const assetOrm = {
      id: assetId,
      userId,
      status: AssetStatus.READY,
      contentType: 'image/png',
      metadata: {},
    };
    manager.findOne.mockResolvedValue(assetOrm);

    await processor.process(job);

    expect(objectStorage.getObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: 'users/u/transaction-attachments/asset-1',
    });
    expect(objectStorage.putObject).toHaveBeenCalledWith({
      bucket: 'private-bucket',
      key: 'users/u/transaction-attachments/asset-1',
      body: optimizedBuffer,
      contentType: 'image/webp',
      checksumSha256Hex: expect.any(String) as string,
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contentType: 'image/webp',
        sizeBytes: String(optimizedBuffer.length),
      }),
    );
  });

  it('aborts database update if asset status changed away from READY during processing', async () => {
    const job = {
      name: TRANSACTION_ATTACHMENT_OPTIMIZE_JOB,
      data: { assetId, userId },
    } as Job<TransactionAttachmentOptimizeJobPayload>;

    const mockAsset = {
      id: assetId,
      status: AssetStatus.READY,
      bucket: 'private-bucket',
      storageKey: 'users/u/transaction-attachments/asset-1',
    } as unknown as Asset;

    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);
    objectStorage.getObject.mockResolvedValue({
      body: Buffer.from('original raw image'),
      contentType: 'image/png',
    });

    const optimizedBuffer = Buffer.from('optimized webp bytes');
    const sharpMockInstance = {
      rotate: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(optimizedBuffer),
      metadata: jest.fn().mockResolvedValue({ width: 1000, height: 1000 }),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(sharpMockInstance);

    // Simulate asset changed to DELETE_PENDING concurrently
    manager.findOne.mockResolvedValue({
      id: assetId,
      userId,
      status: AssetStatus.DELETE_PENDING,
    });

    await processor.process(job);

    expect(manager.save).not.toHaveBeenCalled();
  });
});
