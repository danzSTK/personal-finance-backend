/* eslint-disable @typescript-eslint/unbound-method */
import {
  TRANSACTION_AMOUNT_CENTS_MAX,
  TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION,
} from '@/common/models/constants';
import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { AccountBalanceQueryPort } from '@/modules/accounts/application/ports/account-balance-query.port';
import {
  BalanceAdjustmentNoDifferenceError,
  TransactionAccountUnavailableError,
  TransactionCategoryUnavailableError,
} from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { CreateBalanceAdjustmentUseCase } from '@/modules/transactions/application/use-cases/create-balance-adjustment/create-balance-adjustment.use-case';
import { InvalidTransactionError } from '@/modules/transactions/domain/errors';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { DataSource, EntityManager } from 'typeorm';

describe('CreateBalanceAdjustmentUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const adjustmentCategoryId = '33333333-3333-4333-a333-333333333333';
  const adjustmentDate = toDateOnly('2026-06-23');

  let useCase: CreateBalanceAdjustmentUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let manager: jest.Mocked<EntityManager>;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let accountBalanceQueryPort: jest.Mocked<AccountBalanceQueryPort>;
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

    accountBalanceQueryPort = {
      getCurrentBalanceCents: jest.fn().mockResolvedValue(98000),
    } as unknown as jest.Mocked<AccountBalanceQueryPort>;

    accountBalanceLockPort = {
      lockAccountsForBalanceMutation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountBalanceLockPort>;

    referenceValidator = {
      validate: jest.fn().mockResolvedValue({
        account: { id: accountId },
        destinationAccount: null,
        category: { id: adjustmentCategoryId },
      }),
    } as unknown as jest.Mocked<TransactionReferenceValidator>;

    useCase = new CreateBalanceAdjustmentUseCase(
      dataSource,
      transactionRepository,
      accountBalanceQueryPort,
      accountBalanceLockPort,
      referenceValidator,
    );
  });

  it('locks account, validates references, queries balance, and creates an INCREASE adjustment when target > current', async () => {
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
        category: { id: adjustmentCategoryId },
      } as never);
    });
    accountBalanceQueryPort.getCurrentBalanceCents.mockImplementation(() => {
      callOrder.push('queryBalance');
      return Promise.resolve(98000);
    });
    transactionRepository.save.mockImplementation(tx => {
      callOrder.push('save');
      return Promise.resolve(tx);
    });

    const result = await useCase.execute({
      userId,
      accountId,
      targetBalanceCents: 100000,
      date: adjustmentDate,
      description: '  Conciliação com extrato  ',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['lock', 'validate', 'queryBalance', 'save']);
    expect(accountBalanceLockPort.lockAccountsForBalanceMutation).toHaveBeenCalledWith(
      { userId, accountIds: [accountId] },
      { manager },
    );
    expect(referenceValidator.validate).toHaveBeenCalledWith(
      {
        userId,
        accountId,
        destinationAccountId: null,
        type: TransactionType.ADJUSTMENT,
      },
      { manager },
    );
    expect(accountBalanceQueryPort.getCurrentBalanceCents).toHaveBeenCalledWith({ userId, accountId }, { manager });
    expect(transactionRepository.save).toHaveBeenCalledWith(result, { manager });

    expect(result.userId).toBe(userId);
    expect(result.accountId).toBe(accountId);
    expect(result.destinationAccountId).toBeNull();
    expect(result.categoryId).toBe(adjustmentCategoryId);
    expect(result.type).toBe(TransactionType.ADJUSTMENT);
    expect(result.status).toBe(TransactionStatus.EFFECTIVE);
    expect(result.direction).toBe(TransactionDirection.INCREASE);
    expect(result.amountCents).toBe(2000);
    expect(result.date).toBe('2026-06-23');
    expect(result.effectiveAt).toBeInstanceOf(Date);
    expect(result.description).toBe('Conciliação com extrato');
  });

  it('creates a DECREASE adjustment when target balance is lower than current balance', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(100000);

    const result = await useCase.execute({
      userId,
      accountId,
      targetBalanceCents: 95000,
      date: adjustmentDate,
      description: 'Tarifa esquecida',
    });

    expect(result.direction).toBe(TransactionDirection.DECREASE);
    expect(result.amountCents).toBe(5000);
    expect(result.status).toBe(TransactionStatus.EFFECTIVE);
    expect(result.description).toBe('Tarifa esquecida');
  });

  it('supports negative target balance from positive current balance', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(5000);

    const result = await useCase.execute({
      userId,
      accountId,
      targetBalanceCents: -10000,
      date: adjustmentDate,
    });

    expect(result.direction).toBe(TransactionDirection.DECREASE);
    expect(result.amountCents).toBe(15000);
    expect(result.description).toBe(TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION);
  });

  it('supports zero target balance from negative current balance', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(-10000);

    const result = await useCase.execute({
      userId,
      accountId,
      targetBalanceCents: 0,
      date: adjustmentDate,
      description: null,
    });

    expect(result.direction).toBe(TransactionDirection.INCREASE);
    expect(result.amountCents).toBe(10000);
    expect(result.description).toBe(TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION);
  });

  it('falls back to default description when description is blank whitespace', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(1000);

    const result = await useCase.execute({
      userId,
      accountId,
      targetBalanceCents: 2000,
      date: adjustmentDate,
      description: '   ',
    });

    expect(result.description).toBe(TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION);
  });

  it('throws BalanceAdjustmentNoDifferenceError when target balance equals current balance', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(98000);

    await expect(
      useCase.execute({
        userId,
        accountId,
        targetBalanceCents: 98000,
        date: adjustmentDate,
      }),
    ).rejects.toThrow(BalanceAdjustmentNoDifferenceError);

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('throws InvalidTransactionError when delta exceeds TRANSACTION_AMOUNT_CENTS_MAX', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(-100);

    await expect(
      useCase.execute({
        userId,
        accountId,
        targetBalanceCents: TRANSACTION_AMOUNT_CENTS_MAX,
        date: adjustmentDate,
      }),
    ).rejects.toThrow(InvalidTransactionError);

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('throws InvalidTransactionError when targetBalanceCents is not a safe integer', async () => {
    await expect(
      useCase.execute({
        userId,
        accountId,
        targetBalanceCents: 12.5,
        date: adjustmentDate,
      }),
    ).rejects.toThrow(InvalidTransactionError);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('propagates TransactionAccountUnavailableError when account is unavailable', async () => {
    referenceValidator.validate.mockRejectedValue(new TransactionAccountUnavailableError());

    await expect(
      useCase.execute({
        userId,
        accountId,
        targetBalanceCents: 100000,
        date: adjustmentDate,
      }),
    ).rejects.toThrow(TransactionAccountUnavailableError);

    expect(accountBalanceQueryPort.getCurrentBalanceCents).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('throws TransactionAccountUnavailableError when balance query returns null', async () => {
    accountBalanceQueryPort.getCurrentBalanceCents.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId,
        accountId,
        targetBalanceCents: 100000,
        date: adjustmentDate,
      }),
    ).rejects.toThrow(TransactionAccountUnavailableError);

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('propagates TransactionCategoryUnavailableError when technical category is unavailable', async () => {
    referenceValidator.validate.mockRejectedValue(new TransactionCategoryUnavailableError());

    await expect(
      useCase.execute({
        userId,
        accountId,
        targetBalanceCents: 100000,
        date: adjustmentDate,
      }),
    ).rejects.toThrow(TransactionCategoryUnavailableError);

    expect(transactionRepository.save).not.toHaveBeenCalled();
  });
});
