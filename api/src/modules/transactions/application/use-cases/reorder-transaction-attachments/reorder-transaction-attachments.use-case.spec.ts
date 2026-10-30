/* eslint-disable @typescript-eslint/unbound-method */
import { InvalidAttachmentPositionError } from '@/modules/transactions/domain/errors';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { ReorderTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.use-case';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('ReorderTransactionAttachmentsUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';

  let useCase: ReorderTransactionAttachmentsUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as jest.Mocked<DataSource>;

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

    useCase = new ReorderTransactionAttachmentsUseCase(dataSource, attachmentRepository);
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
    manager.findOne.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        positions: [{ id: 'att-1', position: 0 }],
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('rejects when position list length does not match existing attachments count', async () => {
    manager.findOne.mockResolvedValue({ id: transactionId, user_id: userId, deleted_at: null });

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
    manager.findOne.mockResolvedValue({ id: transactionId, user_id: userId, deleted_at: null });

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
    manager.findOne.mockResolvedValue({ id: transactionId, user_id: userId, deleted_at: null });

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

  it('successfully reorders positions', async () => {
    manager.findOne.mockResolvedValue({ id: transactionId, user_id: userId, deleted_at: null });

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

    expect(attachmentRepository.reorderPositions).toHaveBeenCalledWith(transactionId, targetPositions, { manager });
  });
});
