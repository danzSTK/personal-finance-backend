/* eslint-disable @typescript-eslint/unbound-method */
import { TransactionType } from '@/common/models/enums';
import { TransactionNotFoundError, TransactionUpdateEmptyError } from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionTypeDoesNotSupportAttachmentsError } from '@/modules/transactions/domain/errors';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('UpdateTransactionUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';
  const accountId = '33333333-3333-4333-a333-333333333333';
  const destinationAccountId = '44444444-4444-4444-a444-444444444444';
  const categoryId = '55555555-5555-4555-a555-555555555555';
  const technicalCategoryId = '66666666-6666-4666-a666-666666666666';

  let useCase: UpdateTransactionUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;
  let referenceValidator: jest.Mocked<TransactionReferenceValidator>;

  const createMockTransaction = (type = TransactionType.EXPENSE) =>
    ({
      id: transactionId,
      userId,
      accountId,
      destinationAccountId: null,
      categoryId,
      type,
      applyPatch: jest.fn(),
    }) as unknown as Transaction;

  beforeEach(() => {
    manager = {} as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as jest.Mocked<DataSource>;

    transactionRepository = {
      findByIdAndUserId: jest.fn(),
      findByIdAndUserIdForUpdate: jest.fn(),
      list: jest.fn(),
      save: jest.fn().mockImplementation(tx => Promise.resolve(tx)),
    } as unknown as jest.Mocked<ITransactionRepository>;

    attachmentRepository = {
      findByTransactionId: jest.fn(),
      findByIdAndTransactionId: jest.fn(),
      findReadyByTransactionId: jest.fn(),
      countActiveByTransactionId: jest.fn().mockResolvedValue(0),
      countActiveByTransactionIds: jest.fn(),
      save: jest.fn(),
      saveAll: jest.fn(),
      delete: jest.fn(),
      deleteByIds: jest.fn(),
      deleteInactiveByTransactionId: jest.fn().mockResolvedValue(undefined),
      reorderPositions: jest.fn(),
    } as unknown as jest.Mocked<ITransactionAttachmentRepository>;

    referenceValidator = {
      validate: jest.fn().mockResolvedValue({
        account: { id: accountId },
        destinationAccount: { id: destinationAccountId },
        category: { id: technicalCategoryId },
      }),
    } as unknown as jest.Mocked<TransactionReferenceValidator>;

    useCase = new UpdateTransactionUseCase(dataSource, transactionRepository, attachmentRepository, referenceValidator);
  });

  it('rejects empty patch', async () => {
    await expect(
      useCase.execute({
        userId,
        transactionId,
        patch: {},
      }),
    ).rejects.toThrow(TransactionUpdateEmptyError);
  });

  it('updates non-type fields without opening a lock transaction or querying attachments', async () => {
    const tx = createMockTransaction(TransactionType.EXPENSE);
    transactionRepository.findByIdAndUserId.mockResolvedValue(tx);

    const result = await useCase.execute({
      userId,
      transactionId,
      patch: { description: 'Updated note' },
    });

    expect(result).toBe(tx);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(attachmentRepository.deleteInactiveByTransactionId).not.toHaveBeenCalled();
    expect(attachmentRepository.countActiveByTransactionId).not.toHaveBeenCalled();
    expect(tx.applyPatch).toHaveBeenCalledWith({
      description: 'Updated note',
      categoryId: technicalCategoryId,
    });
    expect(transactionRepository.save).toHaveBeenCalledWith(tx, undefined);
  });

  it('blocks converting transaction with active attachments to TRANSFER', async () => {
    const tx = createMockTransaction(TransactionType.EXPENSE);
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(tx);
    attachmentRepository.countActiveByTransactionId.mockResolvedValue(1);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        patch: { type: TransactionType.TRANSFER, destinationAccountId },
      }),
    ).rejects.toThrow(TransactionTypeDoesNotSupportAttachmentsError);

    expect(transactionRepository.findByIdAndUserIdForUpdate).toHaveBeenCalledWith(transactionId, userId, { manager });
    expect(attachmentRepository.deleteInactiveByTransactionId).toHaveBeenCalledWith(transactionId, { manager });
    expect(attachmentRepository.countActiveByTransactionId).toHaveBeenCalledWith(transactionId, { manager });
    expect(referenceValidator.validate).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('blocks converting transaction with active attachments to ADJUSTMENT', async () => {
    const tx = createMockTransaction(TransactionType.INCOME);
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(tx);
    attachmentRepository.countActiveByTransactionId.mockResolvedValue(2);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        patch: { type: TransactionType.ADJUSTMENT },
      }),
    ).rejects.toThrow(TransactionTypeDoesNotSupportAttachmentsError);

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('allows converting transaction to TRANSFER when no active attachments remain', async () => {
    const tx = createMockTransaction(TransactionType.EXPENSE);
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(tx);
    attachmentRepository.countActiveByTransactionId.mockResolvedValue(0);

    const result = await useCase.execute({
      userId,
      transactionId,
      patch: { type: TransactionType.TRANSFER, destinationAccountId },
    });

    expect(result).toBe(tx);
    expect(attachmentRepository.deleteInactiveByTransactionId).toHaveBeenCalledWith(transactionId, { manager });
    expect(attachmentRepository.countActiveByTransactionId).toHaveBeenCalledWith(transactionId, { manager });
    expect(tx.applyPatch).toHaveBeenCalledWith({
      type: TransactionType.TRANSFER,
      destinationAccountId,
      categoryId: technicalCategoryId,
    });
    expect(transactionRepository.save).toHaveBeenCalledWith(tx, { manager });
  });

  it('throws TransactionNotFoundError when converting a non-existent transaction', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
        patch: { type: TransactionType.ADJUSTMENT },
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });
});
