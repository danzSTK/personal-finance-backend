/* eslint-disable @typescript-eslint/unbound-method */
import { CategoryType } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import {
  TransactionAccountUnavailableError,
  TransactionCategoryUnavailableError,
} from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { EntityManager } from 'typeorm';

describe('TransactionReferenceValidator - validateForBalanceAdjustment', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const categoryId = '33333333-3333-4333-a333-333333333333';

  let validator: TransactionReferenceValidator;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    manager = {} as unknown as jest.Mocked<EntityManager>;

    accountRepository = {
      findByIdAndUserId: jest.fn(),
      findByIdAndUserIdForUpdate: jest.fn(),
      listByUserId: jest.fn(),
      save: jest.fn(),
      findWithoutTemplateForUpdate: jest.fn(),
      unsetDefaultAccount: jest.fn(),
      userHasDefaultAccount: jest.fn(),
      hasAnotherActiveAccount: jest.fn(),
      hasFutureScheduledTransactions: jest.fn(),
      findByUserIdAndType: jest.fn(),
    } as unknown as jest.Mocked<IAccountRepository>;

    categoryRepository = {
      findByIdAndUserId: jest.fn(),
      listByUserId: jest.fn(),
      listByUserIdAndType: jest.fn(),
      listManagementCategories: jest.fn(),
      findActiveByNameAndType: jest.fn(),
      findActiveSystemByType: jest.fn(),
      existsActiveByNameAndType: jest.fn(),
      hasTransactions: jest.fn(),
      moveTransactionsToCategory: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ICategoryRepository>;

    validator = new TransactionReferenceValidator(accountRepository, categoryRepository);
  });

  it('locks active account and resolves active technical ADJUSTMENT category using manager', async () => {
    const account = { id: accountId, isArchived: false } as unknown as Account;
    const category = { id: categoryId, type: CategoryType.ADJUSTMENT, isArchived: false } as unknown as Category;
    accountRepository.findByIdAndUserIdForUpdate.mockResolvedValue(account);
    categoryRepository.findActiveSystemByType.mockResolvedValue(category);

    const result = await validator.validateForBalanceAdjustment({ userId, accountId }, { manager });

    expect(accountRepository.findByIdAndUserIdForUpdate).toHaveBeenCalledWith(accountId, userId, { manager });
    expect(categoryRepository.findActiveSystemByType).toHaveBeenCalledWith(userId, CategoryType.ADJUSTMENT, {
      manager,
    });
    expect(result).toEqual({ account, category });
  });

  it('throws TransactionAccountUnavailableError when account does not exist or is archived', async () => {
    accountRepository.findByIdAndUserIdForUpdate.mockResolvedValue(null);

    await expect(validator.validateForBalanceAdjustment({ userId, accountId }, { manager })).rejects.toThrow(
      TransactionAccountUnavailableError,
    );

    accountRepository.findByIdAndUserIdForUpdate.mockResolvedValue({
      id: accountId,
      isArchived: true,
    } as unknown as Account);

    await expect(validator.validateForBalanceAdjustment({ userId, accountId }, { manager })).rejects.toThrow(
      TransactionAccountUnavailableError,
    );
  });

  it('throws TransactionCategoryUnavailableError when technical ADJUSTMENT category is missing or archived', async () => {
    accountRepository.findByIdAndUserIdForUpdate.mockResolvedValue({
      id: accountId,
      isArchived: false,
    } as unknown as Account);
    categoryRepository.findActiveSystemByType.mockResolvedValue(null);

    await expect(validator.validateForBalanceAdjustment({ userId, accountId }, { manager })).rejects.toThrow(
      TransactionCategoryUnavailableError,
    );
  });
});
