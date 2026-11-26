/* eslint-disable @typescript-eslint/unbound-method */
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { Asset } from '@/modules/assets/domain/entities/asset.entity';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { FiscalNoteTransactionLifecyclePort } from '@/modules/fiscal-notes/application/ports';
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
  const accountId = '33333333-3333-4333-a333-333333333333';
  const destinationAccountId = '44444444-4444-4444-a444-444444444444';

  let useCase: DeleteTransactionUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let attachmentRepository: jest.Mocked<ITransactionAttachmentRepository>;
  let assetRepository: jest.Mocked<IAssetRepository>;
  let accountBalanceLockPort: jest.Mocked<AccountBalanceLockPort>;
  let fiscalNoteLifecyclePort: jest.Mocked<FiscalNoteTransactionLifecyclePort>;

  beforeEach(() => {
    jest.clearAllMocks();
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
      deleteInactiveByTransactionId: jest.fn(),
      reorderPositions: jest.fn(),
    } as unknown as jest.Mocked<ITransactionAttachmentRepository>;

    assetRepository = {
      findByIdAndUserId: jest.fn(),
      save: jest.fn(),
      findPendingDeletionBefore: jest.fn(),
      findStalePendingUploadsBefore: jest.fn(),
    } as unknown as jest.Mocked<IAssetRepository>;

    accountBalanceLockPort = {
      lockAccountsForBalanceMutation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountBalanceLockPort>;

    fiscalNoteLifecyclePort = {
      hasActiveByTransactionId: jest.fn(),
      findActiveTransactionIds: jest.fn(),
      softDeleteByTransactionId: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<FiscalNoteTransactionLifecyclePort>;

    useCase = new DeleteTransactionUseCase(
      dataSource,
      transactionRepository,
      attachmentRepository,
      assetRepository,
      accountBalanceLockPort,
      fiscalNoteLifecyclePort,
    );
  });

  it('rejects when transaction does not exist or is already deleted', async () => {
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        transactionId,
      }),
    ).rejects.toThrow(TransactionNotFoundError);

    expect(accountBalanceLockPort.lockAccountsForBalanceMutation).not.toHaveBeenCalled();
    expect(fiscalNoteLifecyclePort.softDeleteByTransactionId).not.toHaveBeenCalled();
  });

  it('locks involved accounts, marks transaction as deleted, and transitions active attachments to DELETE_PENDING', async () => {
    const mockTx = {
      id: transactionId,
      accountId,
      destinationAccountId: null,
      delete: jest.fn(),
    } as unknown as Transaction;
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTx);

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
      canMarkDeletePending: jest.fn().mockReturnValue(true),
      markDeletePending: jest.fn(),
    } as unknown as Asset;
    assetRepository.findByIdAndUserId.mockResolvedValue(mockAsset);

    await useCase.execute({
      userId,
      transactionId,
    });

    expect(transactionRepository.findByIdAndUserIdForUpdate).toHaveBeenCalledWith(transactionId, userId, { manager });
    expect(mockTx.delete).toHaveBeenCalled();
    expect(accountBalanceLockPort.lockAccountsForBalanceMutation).toHaveBeenCalledWith(
      { userId, accountIds: [accountId] },
      { manager },
    );
    expect(transactionRepository.save).toHaveBeenCalledWith(mockTx, { manager });
    expect(fiscalNoteLifecyclePort.softDeleteByTransactionId).toHaveBeenCalledWith(transactionId, userId, { manager });
    expect(mockAsset.markDeletePending).toHaveBeenCalled();
    expect(assetRepository.save).toHaveBeenCalledWith(mockAsset, { manager });
  });

  it('locks both origin and destination accounts when deleting a TRANSFER transaction', async () => {
    const mockTx = {
      id: transactionId,
      accountId,
      destinationAccountId,
      delete: jest.fn(),
    } as unknown as Transaction;
    transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(mockTx);
    attachmentRepository.findByTransactionId.mockResolvedValue([]);

    await useCase.execute({
      userId,
      transactionId,
    });

    expect(accountBalanceLockPort.lockAccountsForBalanceMutation).toHaveBeenCalledWith(
      { userId, accountIds: [accountId, destinationAccountId] },
      { manager },
    );
    expect(transactionRepository.save).toHaveBeenCalledWith(mockTx, { manager });
  });
});
