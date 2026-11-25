/* eslint-disable @typescript-eslint/unbound-method */
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('CreateTransactionUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const destinationAccountId = '33333333-3333-4333-a333-333333333333';
  const categoryId = '44444444-4444-4444-a444-444444444444';
  const technicalTransferCategoryId = '55555555-5555-4555-a555-555555555555';
  const transactionDate = toDateOnly('2026-06-23');

  let useCase: CreateTransactionUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let accountBalanceLockPort: jest.Mocked<AccountBalanceLockPort>;
  let referenceValidator: jest.Mocked<TransactionReferenceValidator>;

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

    accountBalanceLockPort = {
      lockAccountsForBalanceMutation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountBalanceLockPort>;

    referenceValidator = {
      validate: jest.fn().mockResolvedValue({
        account: { id: accountId },
        destinationAccount: null,
        category: { id: categoryId },
      }),
    } as unknown as jest.Mocked<TransactionReferenceValidator>;

    useCase = new CreateTransactionUseCase(
      dataSource,
      transactionRepository,
      accountBalanceLockPort,
      referenceValidator,
    );
  });

  it('locks origin account, validates references, and saves transaction inside a single DB transaction', async () => {
    const callOrder: string[] = [];
    accountBalanceLockPort.lockAccountsForBalanceMutation.mockImplementation(() => {
      callOrder.push('lock');
      return Promise.resolve();
    });
    referenceValidator.validate.mockImplementation(() => {
      callOrder.push('validate');
      return Promise.resolve({
        account: { id: accountId },
        destinationAccount: null,
        category: { id: categoryId },
      } as never);
    });
    transactionRepository.save.mockImplementation(tx => {
      callOrder.push('save');
      return Promise.resolve(tx);
    });

    const result = await useCase.execute({
      userId,
      accountId,
      categoryId,
      type: TransactionType.EXPENSE,
      status: TransactionStatus.EFFECTIVE,
      amountCents: 2500,
      date: transactionDate,
      description: 'Almoço',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['lock', 'validate', 'save']);
    expect(accountBalanceLockPort.lockAccountsForBalanceMutation).toHaveBeenCalledWith(
      { userId, accountIds: [accountId] },
      { manager },
    );
    expect(referenceValidator.validate).toHaveBeenCalledWith(
      {
        userId,
        accountId,
        destinationAccountId: null,
        categoryId,
        type: TransactionType.EXPENSE,
      },
      { manager },
    );
    expect(transactionRepository.save).toHaveBeenCalledWith(result, { manager });
  });

  it('locks both origin and destination accounts when creating a TRANSFER', async () => {
    referenceValidator.validate.mockResolvedValue({
      account: { id: accountId },
      destinationAccount: { id: destinationAccountId },
      category: { id: technicalTransferCategoryId },
    } as never);

    const result = await useCase.execute({
      userId,
      accountId,
      destinationAccountId,
      type: TransactionType.TRANSFER,
      status: TransactionStatus.EFFECTIVE,
      amountCents: 10000,
      date: transactionDate,
      description: 'Transferência',
    });

    expect(accountBalanceLockPort.lockAccountsForBalanceMutation).toHaveBeenCalledWith(
      { userId, accountIds: [accountId, destinationAccountId] },
      { manager },
    );
    expect(transactionRepository.save).toHaveBeenCalledWith(result, { manager });
  });
});
