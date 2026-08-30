/* eslint-disable @typescript-eslint/unbound-method */
import { AccountTemplateInputConflictError, AccountTemplateNotFoundError } from '@/modules/accounts/application/errors';
import { IAccountCacheInvalidator } from '@/modules/accounts/application/ports/account-cache-invalidator.interface';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import type { DataSource, EntityManager } from 'typeorm';
import { UpdateAccountUseCase } from './update-account.use-case';

describe('UpdateAccountUseCase', () => {
  const userId = '7959495d-7c8a-451d-b308-da032c20e615';
  const manager = {} as EntityManager;
  let useCase: UpdateAccountUseCase;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let templateRepository: jest.Mocked<IAccountTemplateRepository>;
  let dataSource: DataSource;

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
    const transaction = jest.fn(
      async <T>(callback: (transactionManager: EntityManager) => Promise<T>): Promise<T> => callback(manager),
    );
    dataSource = { transaction } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateAccountUseCase,
        { provide: IAccountRepository, useValue: accountRepository },
        { provide: IAccountTemplateRepository, useValue: templateRepository },
        {
          provide: IAccountCacheInvalidator,
          useValue: { invalidateUserAccounts: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    useCase = module.get(UpdateAccountUseCase);
  });

  describe('execute', () => {
    it('associates an institutional template with a v0.3-compatible legacy color', async () => {
      const account = customAccount();
      const template = institutionalTemplate();
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findActiveInstitutionalById.mockResolvedValue(template);

      const output = await useCase.execute({
        userId,
        accountId: account.id,
        patch: { template: { type: 'institutional', templateId: template.id } },
      });

      expect(output.account.templateId).toBe(template.id);
      expect(output.account.color).toBe(ColorToken.PURPLE);
      expect(output.account.icon).toBe(IconKey.LANDMARK);
      expect(output.template.colorToken).toBe('nubank');
    });

    it('materializes a private custom template when a v0.3 visual update replaces an institution', async () => {
      const account = institutionalAccount();
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findByIdsForRendering.mockResolvedValue([institutionalTemplate()]);

      const output = await useCase.execute({
        userId,
        accountId: account.id,
        patch: { color: ColorToken.BLUE },
      });

      expect(templateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
          ownerUserId: userId,
          colorToken: ColorToken.BLUE,
          iconKey: IconKey.LANDMARK,
        }),
        { manager },
      );
      expect(output.account.templateId).toBe(output.template.id);
      expect(output.account.color).toBe(ColorToken.BLUE);
      expect(output.template.type).toBe(ACCOUNT_TEMPLATE_TYPE.CUSTOM);
    });

    it('detects visual divergence left by a v0.3 writer during an unrelated patch', async () => {
      const account = institutionalAccount();
      account.changerColor(ColorToken.GREEN);
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findByIdsForRendering.mockResolvedValue([institutionalTemplate()]);

      const output = await useCase.execute({
        userId,
        accountId: account.id,
        patch: { name: 'Conta alterada pela imagem nova' },
      });

      expect(output.template.type).toBe(ACCOUNT_TEMPLATE_TYPE.CUSTOM);
      expect(output.template.colorToken).toBe(ColorToken.GREEN);
      expect(output.template.iconKey).toBe(IconKey.LANDMARK);
      expect(output.account.templateId).toBe(output.template.id);
    });

    it('creates a backend-classified custom template without carrying institutional fallback fields', async () => {
      const account = institutionalAccount();
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findByIdsForRendering.mockResolvedValue([institutionalTemplate()]);

      const output = await useCase.execute({
        userId,
        accountId: account.id,
        patch: { template: { type: 'custom', colorToken: ColorToken.BLUE } },
      });

      expect(output.template.type).toBe(ACCOUNT_TEMPLATE_TYPE.CUSTOM);
      expect(output.template.colorToken).toBe(ColorToken.BLUE);
      expect(output.template.iconKey).toBeNull();
      expect(output.account.icon).toBeNull();
    });

    it('preserves omitted custom fields when patching the current custom template', async () => {
      const account = customAccount();
      const current = customTemplate();
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findByIdsForRendering.mockResolvedValue([current]);

      const output = await useCase.execute({
        userId,
        accountId: account.id,
        patch: { template: { type: 'custom', colorToken: ColorToken.PURPLE } },
      });

      expect(output.template.id).toBe(current.id);
      expect(output.template.colorToken).toBe(ColorToken.PURPLE);
      expect(output.template.iconKey).toBe(IconKey.WALLET);
    });

    it('keeps the private custom template name aligned when the account is renamed', async () => {
      const account = customAccount();
      const current = customTemplate();
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findByIdsForRendering.mockResolvedValue([current]);

      const output = await useCase.execute({
        userId,
        accountId: account.id,
        patch: { name: 'Conta renomeada' },
      });

      expect(output.account.name).toBe('Conta renomeada');
      expect(output.template.name).toBe('Conta renomeada');
      expect(templateRepository.save).toHaveBeenCalledWith(current, { manager });
    });

    it('rejects an institutional input that points to a persisted custom template', async () => {
      const account = institutionalAccount();
      accountRepository.findByIdAndUserId.mockResolvedValue(account);
      templateRepository.findActiveInstitutionalById.mockResolvedValue(customTemplate());

      await expect(
        useCase.execute({
          userId,
          accountId: account.id,
          patch: {
            template: { type: 'institutional', templateId: '0795ab53-402f-4754-a5b3-f7449338a2e9' },
          },
        }),
      ).rejects.toBeInstanceOf(AccountTemplateNotFoundError);

      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a mixed template and legacy patch before opening a transaction', async () => {
      await expect(
        useCase.execute({
          userId,
          accountId: 'd3109bb3-f226-4eaf-a515-44696f61732e',
          patch: {
            template: { type: 'institutional', templateId: '54066cca-075e-4300-923b-f5b36462aa1f' },
            icon: IconKey.WALLET,
          },
        }),
      ).rejects.toBeInstanceOf(AccountTemplateInputConflictError);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  function institutionalAccount(): Account {
    const now = new Date('2026-08-29T00:00:00.000Z');
    return Account.reconstitute(
      {
        userId,
        name: 'Nubank',
        type: AccountType.BANK,
        initialBalanceCents: 0,
        templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
        color: ColorToken.PURPLE,
        icon: IconKey.LANDMARK,
        includeInTotal: true,
        isArchived: false,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      'd3109bb3-f226-4eaf-a515-44696f61732e',
    );
  }

  function institutionalTemplate(): AccountTemplate {
    const now = new Date('2026-08-29T00:00:00.000Z');
    return AccountTemplate.reconstitute(
      {
        type: ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL,
        ownerUserId: null,
        catalogKey: 'nubank',
        name: 'Nubank',
        colorToken: 'nubank',
        iconKey: null,
        logoStorageKey: 'banking-institutions-icons/nubank.svg',
        bankCode: 260,
        ispb: '18236120',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      '54066cca-075e-4300-923b-f5b36462aa1f',
    );
  }

  function customAccount(): Account {
    const now = new Date('2026-08-29T00:00:00.000Z');
    return Account.reconstitute(
      {
        userId,
        name: 'Conta customizada',
        type: AccountType.BANK,
        initialBalanceCents: 0,
        templateId: '0795ab53-402f-4754-a5b3-f7449338a2e9',
        color: ColorToken.BLUE,
        icon: IconKey.WALLET,
        includeInTotal: true,
        isArchived: false,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      },
      '09060318-ce68-4f19-940c-a1e2b2ea54cc',
    );
  }

  function customTemplate(): AccountTemplate {
    const now = new Date('2026-08-29T00:00:00.000Z');
    return AccountTemplate.reconstitute(
      {
        type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
        ownerUserId: userId,
        catalogKey: null,
        name: 'Conta customizada',
        colorToken: ColorToken.BLUE,
        iconKey: IconKey.WALLET,
        logoStorageKey: null,
        bankCode: null,
        ispb: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      '0795ab53-402f-4754-a5b3-f7449338a2e9',
    );
  }
});
