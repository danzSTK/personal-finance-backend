import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { ListTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/list-transaction-attachments/list-transaction-attachments.use-case';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { IObjectStorage } from '@/shared/object-storage';

describe('ListTransactionAttachmentsUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';

  let useCase: ListTransactionAttachmentsUseCase;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;

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

    objectStorage = {
      putObject: jest.fn(),
      deleteObject: jest.fn(),
      headObject: jest.fn(),
      buildPublicUrl: jest.fn(),
      buildSignedReadUrl: jest.fn(),
      getObject: jest.fn(),
    } as unknown as jest.Mocked<IObjectStorage>;

    useCase = new ListTransactionAttachmentsUseCase(transactionRepository, attachmentRepository, objectStorage);
  });

  it('rejects when transaction does not exist or belong to user', async () => {
    transactionRepository.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
      }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('returns empty list when transaction has no ready attachments', async () => {
    transactionRepository.findByIdAndUserId.mockResolvedValue({ id: transactionId } as unknown as Transaction);
    attachmentRepository.findReadyByTransactionId.mockResolvedValue([]);

    const result = await useCase.execute({
      userId,
      transactionId,
    });

    expect(result).toEqual([]);
  });

  it('returns ordered gallery with presigned URLs', async () => {
    transactionRepository.findByIdAndUserId.mockResolvedValue({ id: transactionId } as unknown as Transaction);

    const attachment = TransactionAttachment.create({
      transactionId,
      assetId: 'asset-1',
      position: 0,
    });

    const mockAsset = {
      id: 'asset-1',
      bucket: 'private-bucket',
      storageKey: 'users/u/transaction-attachments/asset-1',
      contentType: 'image/webp',
      sizeBytes: 1024,
    } as unknown as Asset;

    attachmentRepository.findReadyByTransactionId.mockResolvedValue([{ attachment, asset: mockAsset }]);

    const expiresAt = new Date(Date.now() + 300 * 1000);
    objectStorage.buildSignedReadUrl.mockResolvedValue({
      url: 'https://signed-url.example.com',
      expiresAt,
      cacheMaxAgeSeconds: 240,
    });

    const result = await useCase.execute({
      userId,
      transactionId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: attachment.id,
      assetId: 'asset-1',
      position: 0,
      contentType: 'image/webp',
      sizeBytes: 1024,
      url: 'https://signed-url.example.com',
      expiresAt,
      cacheMaxAgeSeconds: 240,
    });
  });
});
