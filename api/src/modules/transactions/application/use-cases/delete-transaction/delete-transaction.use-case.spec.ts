/* eslint-disable @typescript-eslint/unbound-method */
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('DeleteTransactionUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';

  let useCase: DeleteTransactionUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;
  let assetRepository: jest.Mocked<IAssetRepository>;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as jest.Mocked<DataSource>;

    transactionRepository = {
      findByIdAndUserId: jest.fn(),
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
      delete: jest.fn(),
      reorderPositions: jest.fn(),
    } as unknown as jest.Mocked<ITransactionAttachmentRepository>;

    assetRepository = {
      findByIdAndUserId: jest.fn(),
      save: jest.fn(),
      findPendingDeletionBefore: jest.fn(),
      findStalePendingUploadsBefore: jest.fn(),
    } as unknown as jest.Mocked<IAssetRepository>;

    useCase = new DeleteTransactionUseCase(dataSource, transactionRepository, attachmentRepository, assetRepository);
  });

  it('rejects when transaction does not exist or is already deleted', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('marks transaction as deleted and transitions active attachments to DELETE_PENDING', async () => {
    manager.findOne.mockResolvedValue({
      id: transactionId,
      user_id: userId,
      deleted_at: null,
    });

    const mockTx = {
      id: transactionId,
      delete: jest.fn(),
    } as unknown as Transaction;
    transactionRepository.findByIdAndUserId.mockResolvedValue(mockTx);

    const attachment = TransactionAttachment.create({
      id: 'att-1',
      transactionId,
      assetId: 'asset-1',
      position: 0,
    });
    attachmentRepository.findByTransactionId.mockResolvedValue([attachment]);

    const mockAsset = {
      id: 'asset-1',
      status: AssetStatus.READY,
      markDeletePending: jest.fn(),
    } as unknown as Asset;
    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);

    await useCase.execute({
      userId,
      transactionId,
    });

    expect(mockTx.delete).toHaveBeenCalled();
    expect(transactionRepository.save).toHaveBeenCalledWith(mockTx, { manager });
    expect(mockAsset.markDeletePending).toHaveBeenCalled();
    expect(assetRepository.save).toHaveBeenCalledWith(mockAsset, { manager });
  });
});
