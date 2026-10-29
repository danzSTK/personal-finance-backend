/* eslint-disable @typescript-eslint/unbound-method */
import type { WorkerConfig } from '@/config/worker.config';
import { Asset, AssetProps } from '@/modules/assets/domain/entities/asset.entity';
import { AssetFailureCode, AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
import { AssetStorageKeyFactory } from '@/modules/assets/domain/factories';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AssetReconcilerService } from '@/modules/assets/application/services/asset-reconciler.service';
import { IObjectStorage } from '@/shared/object-storage/contracts/object-storage.interface';
import { Logger } from '@nestjs/common';

describe('AssetReconcilerService', () => {
  let service: AssetReconcilerService;
  let mockAssetRepository: jest.Mocked<IAssetRepository>;
  let mockObjectStorage: jest.Mocked<IObjectStorage>;
  let mockConfig: WorkerConfig;

  beforeEach(() => {
    jest.useFakeTimers();

    mockAssetRepository = {
      findByIdAndUserId: jest.fn(),
      save: jest.fn().mockImplementation((asset: Asset) => Promise.resolve(asset)),
      findPendingDeletionBefore: jest.fn().mockResolvedValue([]),
      findStalePendingUploadsBefore: jest.fn().mockResolvedValue([]),
    };

    mockObjectStorage = {
      putObject: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      headObject: jest.fn(),
      buildPublicUrl: jest.fn(),
      buildSignedReadUrl: jest.fn(),
      getObject: jest.fn(),
    };

    mockConfig = {
      outbox: {
        pollIntervalMs: 1000,
        batchSize: 25,
        concurrency: 5,
        leaseMs: 30000,
        leaseRenewIntervalMs: 10000,
      },
      emailReconciliation: {
        intervalMs: 30000,
        batchSize: 100,
        staleAfterMs: 30000,
      },
      assetReconciliation: {
        intervalMs: 60000,
        batchSize: 50,
        deleteGracePeriodMs: 30000,
        stalePendingUploadMs: 7200000,
      },
      shutdownTimeoutMs: 30000,
      heartbeat: {
        intervalMs: 10000,
        ttlMs: 30000,
      },
    };

    service = new AssetReconcilerService(mockAssetRepository, mockObjectStorage, mockConfig);
  });

  afterEach(() => {
    service.beforeApplicationShutdown();
    jest.useRealTimers();
  });

  describe('onModuleInit and beforeApplicationShutdown', () => {
    it('schedules periodic reconciliation on module init and unrefs the timer', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      service.onModuleInit();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('clears interval and prevents new runs on shutdown', async () => {
      service.onModuleInit();
      service.beforeApplicationShutdown();

      await service.reconcile();

      expect(mockAssetRepository.findPendingDeletionBefore).not.toHaveBeenCalled();
      expect(mockAssetRepository.findStalePendingUploadsBefore).not.toHaveBeenCalled();
    });
  });

  describe('reconcilePendingDeletions', () => {
    it('deletes physical asset from object storage and marks asset as DELETED (AC-1, AC-2)', async () => {
      const asset = createTestAsset({
        status: AssetStatus.DELETE_PENDING,
        metadata: { width: 400, height: 400, format: 'webp' },
      });
      mockAssetRepository.findPendingDeletionBefore.mockResolvedValueOnce([asset]);

      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await service.reconcile();

      expect(mockAssetRepository.findPendingDeletionBefore).toHaveBeenCalledWith(
        expect.any(Date),
        mockConfig.assetReconciliation.batchSize,
      );
      expect(mockObjectStorage.deleteObject).toHaveBeenCalledWith({
        bucket: asset.bucket,
        key: asset.storageKey,
      });
      expect(asset.status).toBe(AssetStatus.DELETED);
      expect(asset.deletedAt).toBeInstanceOf(Date);
      expect(asset.metadata).toEqual({ width: 400, height: 400, format: 'webp' });
      expect(mockAssetRepository.save).toHaveBeenCalledWith(asset);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Physical asset deleted and marked DELETED'));
    });

    it('handles transient storage failure by incrementing retry attempts and continuing batch (AC-3)', async () => {
      const asset1 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-1');
      const asset2 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-2');
      mockAssetRepository.findPendingDeletionBefore.mockResolvedValueOnce([asset1, asset2]);

      mockObjectStorage.deleteObject
        .mockRejectedValueOnce(new Error('S3 Connection Reset'))
        .mockResolvedValueOnce(undefined);

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await service.reconcile();

      expect(mockObjectStorage.deleteObject).toHaveBeenCalledTimes(2);

      // Asset 1 failed: retried, still DELETE_PENDING
      expect(asset1.status).toBe(AssetStatus.DELETE_PENDING);
      expect(asset1.metadata.delete_attempts).toBe(1);
      expect(asset1.metadata.last_delete_error).toBe('S3 Connection Reset');
      expect(asset1.metadata.quarantine).toBe(false);
      expect(mockAssetRepository.save).toHaveBeenCalledWith(asset1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete asset from object storage; scheduled for retry'),
      );

      // Asset 2 succeeded: DELETED
      expect(asset2.status).toBe(AssetStatus.DELETED);
      expect(mockAssetRepository.save).toHaveBeenCalledWith(asset2);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('assetId=asset-2'));
    });

    it('quarantines asset and emits error log when reaching max retries (AC-4)', async () => {
      const asset = createTestAsset(
        {
          status: AssetStatus.DELETE_PENDING,
          metadata: {
            delete_attempts: 4,
            last_delete_error: 'Previous error',
          },
        },
        'quarantine-asset',
      );
      mockAssetRepository.findPendingDeletionBefore.mockResolvedValueOnce([asset]);
      mockObjectStorage.deleteObject.mockRejectedValueOnce(new Error('S3 403 Forbidden: Invalid Credentials'));

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await service.reconcile();

      expect(asset.status).toBe(AssetStatus.DELETE_PENDING);
      expect(asset.metadata.delete_attempts).toBe(5);
      expect(asset.metadata.quarantine).toBe(true);
      expect(asset.metadata.last_delete_error).toBe('S3 403 Forbidden: Invalid Credentials');
      expect(mockAssetRepository.save).toHaveBeenCalledWith(asset);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ASSET_DELETE_QUARANTINED] Asset reached max delete retries and was quarantined'),
        expect.any(String),
      );
    });

    it('catches and logs save failure when persisting retry state without crashing batch', async () => {
      const asset1 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-1');
      const asset2 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-2');
      mockAssetRepository.findPendingDeletionBefore.mockResolvedValueOnce([asset1, asset2]);

      mockObjectStorage.deleteObject.mockRejectedValueOnce(new Error('R2 Error')).mockResolvedValueOnce(undefined);

      mockAssetRepository.save.mockRejectedValueOnce(new Error('Database lock error')).mockResolvedValueOnce(asset2);

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await service.reconcile();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist asset delete failure retry state. assetId=asset-1'),
        expect.any(String),
      );
      expect(asset2.status).toBe(AssetStatus.DELETED);
    });

    it('catches save failure after deleteObject, reverts DELETED status to DELETE_PENDING, records failure retry and continues batch (DEC-007)', async () => {
      const asset1 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-1');
      const asset2 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-2');
      mockAssetRepository.findPendingDeletionBefore.mockResolvedValueOnce([asset1, asset2]);

      const recordDeleteFailureSpy = jest.spyOn(asset1, 'recordDeleteFailure');

      mockAssetRepository.save
        .mockRejectedValueOnce(new Error('Postgres connection terminated'))
        .mockResolvedValueOnce(asset1)
        .mockResolvedValueOnce(asset2);

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await service.reconcile();

      expect(mockObjectStorage.deleteObject).toHaveBeenCalledWith({
        bucket: asset1.bucket,
        key: asset1.storageKey,
      });
      expect(recordDeleteFailureSpy).toHaveBeenCalledWith('Postgres connection terminated');
      expect(asset1.status).toBe(AssetStatus.DELETE_PENDING);
      expect(asset1.deletedAt).toBeNull();
      expect(asset1.metadata.delete_attempts).toBe(1);
      expect(asset1.metadata.quarantine).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete asset from object storage; scheduled for retry. assetId=asset-1'),
      );

      expect(asset2.status).toBe(AssetStatus.DELETED);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('assetId=asset-2'));
    });

    it('stops processing deletion batch if draining becomes true during loop', async () => {
      const asset1 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-1');
      const asset2 = createTestAsset({ status: AssetStatus.DELETE_PENDING }, 'asset-2');
      mockAssetRepository.findPendingDeletionBefore.mockResolvedValueOnce([asset1, asset2]);

      mockObjectStorage.deleteObject.mockImplementationOnce(() => {
        service.beforeApplicationShutdown();
        return Promise.resolve();
      });

      await service.reconcile();

      expect(mockObjectStorage.deleteObject).toHaveBeenCalledTimes(1);
      expect(asset1.status).toBe(AssetStatus.DELETED);
      expect(mockAssetRepository.findStalePendingUploadsBefore).not.toHaveBeenCalled();
    });
  });

  describe('reconcileStalePendingUploads', () => {
    it('expires stale PENDING_UPLOAD assets to FAILED with UPLOAD_TIMEOUT (AC-5)', async () => {
      const staleAsset = createTestAsset(
        {
          status: AssetStatus.PENDING_UPLOAD,
          contentType: null,
          sizeBytes: null,
          checksum: null,
          failureCode: null,
        },
        'stale-upload',
      );
      mockAssetRepository.findStalePendingUploadsBefore.mockResolvedValueOnce([staleAsset]);

      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await service.reconcile();

      expect(mockAssetRepository.findStalePendingUploadsBefore).toHaveBeenCalledWith(
        expect.any(Date),
        mockConfig.assetReconciliation.batchSize,
      );
      expect(staleAsset.status).toBe(AssetStatus.FAILED);
      expect(staleAsset.failureCode).toBe(AssetFailureCode.UPLOAD_TIMEOUT);
      expect(mockAssetRepository.save).toHaveBeenCalledWith(staleAsset);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Stale pending upload expired to FAILED'));
    });

    it('handles failure when expiring stale upload without breaking loop', async () => {
      const staleAsset1 = createTestAsset({ status: AssetStatus.PENDING_UPLOAD }, 'stale-1');
      const staleAsset2 = createTestAsset({ status: AssetStatus.PENDING_UPLOAD }, 'stale-2');
      mockAssetRepository.findStalePendingUploadsBefore.mockResolvedValueOnce([staleAsset1, staleAsset2]);

      mockAssetRepository.save
        .mockRejectedValueOnce(new Error('DB connection drop'))
        .mockResolvedValueOnce(staleAsset2);

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await service.reconcile();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to expire stale pending upload. assetId=stale-1'),
        expect.any(String),
      );
      expect(staleAsset2.status).toBe(AssetStatus.FAILED);
    });
  });

  describe('concurrency safeguards', () => {
    it('prevents concurrent reconciliation executions when isRunning is true', async () => {
      let resolveFirstFind!: (value: Asset[]) => void;
      mockAssetRepository.findPendingDeletionBefore.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstFind = resolve;
          }),
      );

      const firstExecution = service.reconcile();
      const secondExecution = service.reconcile();

      await secondExecution;
      expect(mockAssetRepository.findPendingDeletionBefore).toHaveBeenCalledTimes(1);

      resolveFirstFind([]);
      await firstExecution;
    });

    it('catches and logs unexpected error thrown during reconciliation cycle', async () => {
      mockAssetRepository.findPendingDeletionBefore.mockRejectedValueOnce(new Error('Fatal DB crash'));

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await service.reconcile();

      expect(errorSpy).toHaveBeenCalledWith('Failed to execute asset reconciliation cycle', expect.any(String));
    });
  });

  function createTestAsset(overrides?: Partial<AssetProps>, id = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d'): Asset {
    const now = new Date();
    const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';

    return Asset.reconstitute(
      {
        userId,
        purpose: AssetPurpose.USER_AVATAR,
        status: AssetStatus.DELETE_PENDING,
        bucket: 'danfy-public-bucket',
        storageKey: AssetStorageKeyFactory.create({
          assetId: id,
          userId,
          purpose: AssetPurpose.USER_AVATAR,
        }),
        contentType: 'image/webp',
        sizeBytes: 1024,
        checksum: 'a'.repeat(64),
        metadata: {},
        failureCode: null,
        readyAt: now,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      },
      id,
    );
  }
});
