/* eslint-disable @typescript-eslint/unbound-method */
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import {
  TransactionAttachmentNotFoundError,
  TransactionNotFoundError,
} from '@/modules/transactions/application/errors';
import { DeleteTransactionAttachmentUseCase } from '@/modules/transactions/application/use-cases/delete-transaction-attachment/delete-transaction-attachment.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('DeleteTransactionAttachmentUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';
  const attachmentId = '33333333-3333-4333-a333-333333333333';
  const assetId = '44444444-4444-4444-a444-444444444444';

  const mockTransaction = { id: transactionId, userId } as unknown as Transaction;

  let useCase: DeleteTransactionAttachmentUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;
  let assetRepository: jest.Mocked<IAssetRepository>;

  beforeEach(() => {
    manager = {} as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as jest.Mocked<DataSource>;

    transactionRepository = {
      findByIdAndUserId: jest.fn(),
      findByIdAndUserIdForUpdate: jest.fn(),
      list: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<ITransactionRepository>;

    attachmentRepository = {
      findByTransactionId: jest.fn(),
      findByIdAndTransactionId: jest.fn(),
      findReadyByTransactionId: jest.fn(),
      countActiveByTransactionId: jest.fn(),
      countActiveByTransactionIds: jest.fn(),
      save: jest.fn(),
      saveAll: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteByIds: jest.fn().mockResolvedValue(undefined),
      deleteInactiveByTransactionId: jest.fn().mockResolvedValue(undefined),
      reorderPositions: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ITransactionAttachmentRepository>;

    assetRepository = {
      findByIdAndUserId: jest.fn(),
      save: jest.fn().mockImplementation(asset => Promise.resolve(asset)),
      findPendingDeletionBefore: jest.fn(),
      findStalePendingUploadsBefore: jest.fn(),
    } as unknown as jest.Mocked<IAssetRepository>;

    useCase = new DeleteTransactionAttachmentUseCase(
      dataSource,
      transactionRepository,
      attachmentRepository,
      assetRepository,
    );
  });

  it('rejects when transaction does not exist', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        attachmentId,
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('rejects when attachment does not exist in the transaction', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);
    attachmentRepository.findByIdAndTransactionId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        attachmentId,
      }),
    ).rejects.toThrow(TransactionAttachmentNotFoundError);
  });

  it('deletes attachment, purges stale links, reorders remaining, and marks asset as DELETE_PENDING', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const targetAttachment = TransactionAttachment.create({
      id: attachmentId,
      transactionId,
      assetId,
      position: 0,
    });

    const secondAttachment = TransactionAttachment.create({
      id: '55555555-5555-4555-a555-555555555555',
      transactionId,
      assetId: '66666666-6666-4666-a666-666666666666',
      position: 1,
    });

    attachmentRepository.findByIdAndTransactionId.mockResolvedValue(targetAttachment);
    attachmentRepository.findByTransactionId.mockResolvedValue([secondAttachment]);

    const mockAsset = {
      id: assetId,
      status: AssetStatus.READY,
      canMarkDeletePending: jest.fn().mockReturnValue(true),
      markDeletePending: jest.fn(),
    };
    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset as unknown as Asset);

    await useCase.execute({
      userId,
      transactionId,
      attachmentId,
    });

    expect(transactionRepository.findByIdAndUserIdForUpdate).toHaveBeenCalledWith(transactionId, userId, { manager });
    expect(attachmentRepository.deleteInactiveByTransactionId).toHaveBeenCalledWith(transactionId, { manager });
    expect(attachmentRepository.delete).toHaveBeenCalledWith(attachmentId, { manager });
    expect(attachmentRepository.reorderPositions).toHaveBeenCalledWith(
      transactionId,
      [{ id: secondAttachment.id, position: 0 }],
      { manager },
    );
    expect(mockAsset.canMarkDeletePending).toHaveBeenCalled();
    expect(mockAsset.markDeletePending).toHaveBeenCalled();
    expect(assetRepository.save).toHaveBeenCalledWith(mockAsset, { manager });
  });

  it('skips marking asset as DELETE_PENDING when asset is not eligible for deletion', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const targetAttachment = TransactionAttachment.create({
      id: attachmentId,
      transactionId,
      assetId,
      position: 0,
    });

    attachmentRepository.findByIdAndTransactionId.mockResolvedValue(targetAttachment);
    attachmentRepository.findByTransactionId.mockResolvedValue([]);

    const mockAsset = {
      id: assetId,
      status: AssetStatus.DELETE_PENDING,
      canMarkDeletePending: jest.fn().mockReturnValue(false),
      markDeletePending: jest.fn(),
    };
    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset as unknown as Asset);

    await useCase.execute({
      userId,
      transactionId,
      attachmentId,
    });

    expect(mockAsset.markDeletePending).not.toHaveBeenCalled();
    expect(assetRepository.save).not.toHaveBeenCalled();
  });
});
