/* eslint-disable @typescript-eslint/unbound-method */
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import type { DataSource, EntityManager } from 'typeorm';
import { ReconcileLegacyAccountTemplatesUseCase } from './reconcile-legacy-account-templates.use-case';

describe('ReconcileLegacyAccountTemplatesUseCase', () => {
  const manager = {} as EntityManager;
  let useCase: ReconcileLegacyAccountTemplatesUseCase;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let templateRepository: jest.Mocked<IAccountTemplateRepository>;
  let transaction: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    accountRepository = {
      findByIdAndUserId: jest.fn(),
      listByUserId: jest.fn(),
      findWithoutTemplateForUpdate: jest.fn(),
      save: jest.fn((account: Account): Promise<Account> => Promise.resolve(account)),
      unsetDefaultAccount: jest.fn(),
      userHasDefaultAccount: jest.fn(),
      hasAnotherActiveAccount: jest.fn(),
      hasFutureScheduledTransactions: jest.fn(),
      findByUserIdAndType: jest.fn(),
    };
    templateRepository = {
      findActiveInstitutionalById: jest.fn(),
      findByIdsForRendering: jest.fn(),
      listActiveInstitutional: jest.fn(),
      findInstitutionalByCatalogKey: jest.fn(),
      save: jest.fn((template: AccountTemplate): Promise<AccountTemplate> => Promise.resolve(template)),
    };
    transaction = jest.fn(
      async <T>(callback: (transactionManager: EntityManager) => Promise<T>): Promise<T> => callback(manager),
    );
    const dataSource = { transaction } as unknown as DataSource;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconcileLegacyAccountTemplatesUseCase,
        { provide: IAccountRepository, useValue: accountRepository },
        { provide: IAccountTemplateRepository, useValue: templateRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    useCase = module.get(ReconcileLegacyAccountTemplatesUseCase);
  });

  describe('execute', () => {
    it('processes short transactional batches and sanitizes institutional-only legacy colors', async () => {
      const first = legacyAccount('7959495d-7c8a-451d-b308-da032c20e615', ColorToken.BLUE, IconKey.WALLET);
      const second = legacyAccount('0aa8f64c-f88d-4112-96fa-716017442d33', 'nubank', IconKey.LANDMARK);
      const third = legacyAccount('7242a48c-b86d-427a-a83c-3b9fc77090e9', null, null);
      accountRepository.findWithoutTemplateForUpdate
        .mockResolvedValueOnce([first, second])
        .mockResolvedValueOnce([third]);

      await expect(useCase.execute(2)).resolves.toBe(3);

      expect(transaction).toHaveBeenCalledTimes(2);
      expect(templateRepository.save).toHaveBeenCalledTimes(3);
      expect(templateRepository.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: ACCOUNT_TEMPLATE_TYPE.CUSTOM, colorToken: null }),
        { manager },
      );
      expect(accountRepository.save).toHaveBeenCalledTimes(3);
      expect([first.templateId, second.templateId, third.templateId]).not.toContain(null);
    });

    it('is idempotent when no legacy account remains', async () => {
      accountRepository.findWithoutTemplateForUpdate.mockResolvedValue([]);

      await expect(useCase.execute()).resolves.toBe(0);

      expect(templateRepository.save).not.toHaveBeenCalled();
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('can be restarted after a failed batch without relying on process state', async () => {
      const failedAttempt = legacyAccount('7959495d-7c8a-451d-b308-da032c20e615', ColorToken.BLUE, IconKey.WALLET);
      const retryAttempt = legacyAccount('7959495d-7c8a-451d-b308-da032c20e615', ColorToken.BLUE, IconKey.WALLET);
      accountRepository.findWithoutTemplateForUpdate
        .mockResolvedValueOnce([failedAttempt])
        .mockResolvedValueOnce([retryAttempt]);
      templateRepository.save
        .mockRejectedValueOnce(new Error('postgres unavailable'))
        .mockImplementationOnce((template: AccountTemplate) => Promise.resolve(template));

      await expect(useCase.execute(2)).rejects.toThrow('postgres unavailable');
      await expect(useCase.execute(2)).resolves.toBe(1);

      expect(transaction).toHaveBeenCalledTimes(2);
      expect(retryAttempt.templateId).not.toBeNull();
    });

    it.each([0, 1.5, 1001])('rejects invalid batch size %s before opening a transaction', async batchSize => {
      await expect(useCase.execute(batchSize)).rejects.toThrow('batchSize must be an integer between 1 and 1000.');
      expect(transaction).not.toHaveBeenCalled();
    });
  });
});

function legacyAccount(userId: string, color: Account['color'], icon: IconKey | null): Account {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return Account.reconstitute(
    {
      userId,
      name: 'Conta legada',
      type: AccountType.BANK,
      initialBalanceCents: 0,
      templateId: null,
      color,
      icon,
      includeInTotal: true,
      isArchived: false,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    },
    `${userId.slice(0, 8)}-d6eb-4f91-ab71-f17a2320430a`,
  );
}
