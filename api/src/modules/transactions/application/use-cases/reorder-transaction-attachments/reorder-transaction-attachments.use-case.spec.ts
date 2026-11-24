/* eslint-disable @typescript-eslint/unbound-method */
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { ReorderTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { InvalidAttachmentPositionError } from '@/modules/transactions/domain/errors';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('ReorderTransactionAttachmentsUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';
  const mockTransaction = { id: transactionId, userId } as unknown as Transaction;

  let useCase: ReorderTransactionAttachmentsUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;

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
      delete: jest.fn(),
      deleteByIds: jest.fn(),
      deleteInactiveByTransactionId: jest.fn().mockResolvedValue(undefined),
      reorderPositions: jest.fn(),
    } as unknown as jest.Mocked<ITransactionAttachmentRepository>;

    useCase = new ReorderTransactionAttachmentsUseCase(dataSource, transactionRepository, attachmentRepository);
  });

  it('does nothing when positions array is empty', async () => {
    await useCase.execute({
      userId,
      transactionId,
      positions: [],
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when transaction does not exist or is deleted', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        positions: [{ id: 'att-1', position: 0 }],
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('rejects when position list length does not match existing attachments count', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const att1 = TransactionAttachment.create({ id: 'att-1', transactionId, assetId: 'a1', position: 0 });
    const att2 = TransactionAttachment.create({ id: 'att-2', transactionId, assetId: 'a2', position: 1 });
    attachmentRepository.findByTransactionId.mockResolvedValue([att1, att2]);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        positions: [{ id: 'att-1', position: 0 }],
      }),
    ).rejects.toThrow(InvalidAttachmentPositionError);
  });

  it('rejects when an attachment ID does not belong to the transaction', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const att1 = TransactionAttachment.create({ id: 'att-1', transactionId, assetId: 'a1', position: 0 });
    attachmentRepository.findByTransactionId.mockResolvedValue([att1]);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        positions: [{ id: 'foreign-id', position: 0 }],
      }),
    ).rejects.toThrow(InvalidAttachmentPositionError);
  });

  it('rejects when duplicate positions are provided', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const att1 = TransactionAttachment.create({ id: 'att-1', transactionId, assetId: 'a1', position: 0 });
    const att2 = TransactionAttachment.create({ id: 'att-2', transactionId, assetId: 'a2', position: 1 });
    attachmentRepository.findByTransactionId.mockResolvedValue([att1, att2]);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        positions: [
          { id: 'att-1', position: 0 },
          { id: 'att-2', position: 0 },
        ],
      }),
    ).rejects.toThrow(InvalidAttachmentPositionError);
  });

  it('rejects when duplicate attachment IDs are provided with distinct positions', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const att1 = TransactionAttachment.create({ id: 'att-1', transactionId, assetId: 'a1', position: 0 });
    const att2 = TransactionAttachment.create({ id: 'att-2', transactionId, assetId: 'a2', position: 1 });
    attachmentRepository.findByTransactionId.mockResolvedValue([att1, att2]);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        positions: [
          { id: 'att-1', position: 0 },
          { id: 'att-1', position: 1 },
        ],
      }),
    ).rejects.toThrow(InvalidAttachmentPositionError);

    expect(attachmentRepository.reorderPositions).not.toHaveBeenCalled();
  });

  it('successfully reorders positions', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTransaction);

    const att1 = TransactionAttachment.create({ id: 'att-1', transactionId, assetId: 'a1', position: 0 });
    const att2 = TransactionAttachment.create({ id: 'att-2', transactionId, assetId: 'a2', position: 1 });
    attachmentRepository.findByTransactionId.mockResolvedValue([att1, att2]);

    const targetPositions = [
      { id: 'att-1', position: 1 },
      { id: 'att-2', position: 0 },
    ];

    await useCase.execute({
      userId,
      transactionId,
      positions: targetPositions,
    });

    expect(transactionRepository.findByIdAndUserIdForUpdate).toHaveBeenCalledWith(transactionId, userId, { manager });
    expect(attachmentRepository.deleteInactiveByTransactionId).toHaveBeenCalledWith(transactionId, { manager });
    expect(attachmentRepository.reorderPositions).toHaveBeenCalledWith(transactionId, targetPositions, { manager });
  });
});
