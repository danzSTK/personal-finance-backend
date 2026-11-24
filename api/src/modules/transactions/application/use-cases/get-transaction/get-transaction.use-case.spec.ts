/* eslint-disable @typescript-eslint/unbound-method */
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { GetTransactionUseCase } from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.use-case';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';

describe('GetTransactionUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';

  let useCase: GetTransactionUseCase;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;

  beforeEach(() => {
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

    useCase = new GetTransactionUseCase(transactionRepository, attachmentRepository);
  });

  it('rejects when transaction not found', async () => {
    transactionRepository.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('returns transaction with computed attachmentsCount', async () => {
    const mockTx = {
      id: transactionId,
      setAttachmentsCount: jest.fn(),
      attachmentsCount: 2,
    } as unknown as Transaction;

    transactionRepository.findByIdAndUserId.mockResolvedValue(mockTx);
    attachmentRepository.countActiveByTransactionId.mockResolvedValue(2);

    const result = await useCase.execute({
      userId,
      transactionId,
    });

    expect(result).toBe(mockTx);
    expect(mockTx.setAttachmentsCount).toHaveBeenCalledWith(2);
  });
});
