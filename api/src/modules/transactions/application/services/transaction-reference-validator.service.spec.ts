/* eslint-disable @typescript-eslint/unbound-method */
import { CategoryType, TransactionType } from '@/common/models/enums';
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

describe('TransactionReferenceValidator', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const destinationAccountId = '33333333-3333-4333-a333-333333333333';
  const categoryId = '44444444-4444-4444-a444-444444444444';

  let validator: TransactionReferenceValidator;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let categoryRepository: jest.Mocked<ICategoryRepository>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    manager = {} as unknown as jest.Mocked<EntityManager>;

    accountRepository = {
      findByIdAndUserId: jest.fn(),
      findByIdsAndUserIdForUpdate: jest.fn(),
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

  it('validates active account and resolves active technical ADJUSTMENT category propagating manager', async () => {
    const account = { id: accountId, isArchived: false } as unknown as Account;
    const category = { id: categoryId, type: CategoryType.ADJUSTMENT, isArchived: false } as unknown as Category;
    accountRepository.findByIdAndUserId.mockResolvedValue(account);
    categoryRepository.findActiveSystemByType.mockResolvedValue(category);

    const result = await validator.validate(
      { userId, accountId, destinationAccountId: null, type: TransactionType.ADJUSTMENT },
      { manager },
    );

    expect(accountRepository.findByIdAndUserId).toHaveBeenCalledWith(accountId, userId, { manager });
    expect(categoryRepository.findActiveSystemByType).toHaveBeenCalledWith(userId, CategoryType.ADJUSTMENT, {
      manager,
    });
    expect(result).toEqual({ account, destinationAccount: null, category });
  });

  it('propagates manager to origin account, destination account, and technical category for TRANSFER', async () => {
    const originAccount = { id: accountId, isArchived: false } as unknown as Account;
    const destAccount = { id: destinationAccountId, isArchived: false } as unknown as Account;
    const category = { id: categoryId, type: CategoryType.TRANSFER, isArchived: false } as unknown as Category;
    accountRepository.findByIdAndUserId.mockResolvedValueOnce(originAccount).mockResolvedValueOnce(destAccount);
    categoryRepository.findActiveSystemByType.mockResolvedValue(category);

    const result = await validator.validate(
      { userId, accountId, destinationAccountId, type: TransactionType.TRANSFER },
      { manager },
    );

    expect(accountRepository.findByIdAndUserId).toHaveBeenNthCalledWith(1, accountId, userId, { manager });
    expect(accountRepository.findByIdAndUserId).toHaveBeenNthCalledWith(2, destinationAccountId, userId, { manager });
    expect(categoryRepository.findActiveSystemByType).toHaveBeenCalledWith(userId, CategoryType.TRANSFER, {
      manager,
    });
    expect(result).toEqual({ account: originAccount, destinationAccount: destAccount, category });
  });

  it('throws TransactionAccountUnavailableError when account does not exist or is archived', async () => {
    accountRepository.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      validator.validate(
        { userId, accountId, destinationAccountId: null, type: TransactionType.ADJUSTMENT },
        { manager },
      ),
    ).rejects.toThrow(TransactionAccountUnavailableError);

    accountRepository.findByIdAndUserId.mockResolvedValue({
      id: accountId,
      isArchived: true,
    } as unknown as Account);

    await expect(
      validator.validate(
        { userId, accountId, destinationAccountId: null, type: TransactionType.ADJUSTMENT },
        { manager },
      ),
    ).rejects.toThrow(TransactionAccountUnavailableError);
  });

  it('throws TransactionCategoryUnavailableError when technical ADJUSTMENT category is missing or archived', async () => {
    accountRepository.findByIdAndUserId.mockResolvedValue({
      id: accountId,
      isArchived: false,
    } as unknown as Account);
    categoryRepository.findActiveSystemByType.mockResolvedValue(null);

    await expect(
      validator.validate(
        { userId, accountId, destinationAccountId: null, type: TransactionType.ADJUSTMENT },
        { manager },
      ),
    ).rejects.toThrow(TransactionCategoryUnavailableError);
  });
});
