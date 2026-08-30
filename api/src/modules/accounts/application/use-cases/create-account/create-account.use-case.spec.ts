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
import { CreateAccountUseCase } from './create-account.use-case';

describe('CreateAccountUseCase', () => {
  const userId = '7959495d-7c8a-451d-b308-da032c20e615';
  const manager = {} as EntityManager;
  let useCase: CreateAccountUseCase;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let templateRepository: jest.Mocked<IAccountTemplateRepository>;
  let cacheInvalidator: jest.Mocked<IAccountCacheInvalidator>;
  let dataSource: DataSource;

  beforeEach(async () => {
    jest.clearAllMocks();

    accountRepository = {
      findByIdAndUserId: jest.fn(),
      listByUserId: jest.fn(),
      findWithoutTemplateForUpdate: jest.fn(),
      save: jest.fn((account: Account): Promise<Account> => Promise.resolve(account)),
      unsetDefaultAccount: jest.fn().mockResolvedValue(undefined),
      userHasDefaultAccount: jest.fn().mockResolvedValue(false),
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
    cacheInvalidator = { invalidateUserAccounts: jest.fn().mockResolvedValue(undefined) };
    const transaction = jest.fn(
      async <T>(callback: (transactionManager: EntityManager) => Promise<T>): Promise<T> => callback(manager),
    );
    dataSource = { transaction } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAccountUseCase,
        { provide: IAccountRepository, useValue: accountRepository },
        { provide: IAccountTemplateRepository, useValue: templateRepository },
        { provide: IAccountCacheInvalidator, useValue: cacheInvalidator },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    useCase = module.get(CreateAccountUseCase);
  });

  describe('execute', () => {
    it('associates an active institutional template and dual-writes the legacy visual fields', async () => {
      const template = institutionalTemplate();
      templateRepository.findActiveInstitutionalById.mockResolvedValue(template);

      const output = await useCase.execute({
        userId,
        name: 'Nubank',
        type: AccountType.BANK,
        template: { type: 'institutional', templateId: template.id },
      });

      expect(templateRepository.findActiveInstitutionalById).toHaveBeenCalledWith(template.id, { manager });
      expect(templateRepository.save).not.toHaveBeenCalled();
      expect(accountRepository.save).toHaveBeenCalledWith(expect.objectContaining({ templateId: template.id }), {
        manager,
      });
      expect(output.account.templateId).toBe(template.id);
      expect(output.account.color).toBe('nubank');
      expect(output.account.icon).toBe(IconKey.LANDMARK);
      expect(output.template).toBe(template);
      expect(cacheInvalidator.invalidateUserAccounts).toHaveBeenCalledWith(userId);
    });

    it('materializes a private custom template for a legacy payload', async () => {
      const output = await useCase.execute({
        userId,
        name: 'Conta manual',
        type: AccountType.BANK,
        color: ColorToken.PURPLE,
        icon: IconKey.WALLET,
      });

      expect(templateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
          ownerUserId: userId,
          colorToken: ColorToken.PURPLE,
          iconKey: IconKey.WALLET,
        }),
        { manager },
      );
      expect(output.account.templateId).toBe(output.template.id);
      expect(output.template.ownerUserId).toBe(userId);
    });

    it('materializes a private custom template from the new custom input', async () => {
      const output = await useCase.execute({
        userId,
        name: 'Conta personalizada',
        type: AccountType.BANK,
        template: {
          type: 'custom',
          colorToken: ColorToken.BLUE,
          iconKey: IconKey.WALLET,
        },
      });

      expect(templateRepository.findActiveInstitutionalById).not.toHaveBeenCalled();
      expect(templateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
          ownerUserId: userId,
          colorToken: ColorToken.BLUE,
          iconKey: IconKey.WALLET,
        }),
        { manager },
      );
      expect(output.account.color).toBe(ColorToken.BLUE);
      expect(output.account.icon).toBe(IconKey.WALLET);
    });

    it('rejects an institutional input that points to a persisted custom template', async () => {
      const template = customTemplate();
      templateRepository.findActiveInstitutionalById.mockResolvedValue(template);

      await expect(
        useCase.execute({
          userId,
          name: 'Conta forjada',
          type: AccountType.BANK,
          template: { type: 'institutional', templateId: template.id },
        }),
      ).rejects.toBeInstanceOf(AccountTemplateNotFoundError);

      expect(templateRepository.save).not.toHaveBeenCalled();
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an institutional template that is missing or inactive', async () => {
      templateRepository.findActiveInstitutionalById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId,
          name: 'Conta indisponível',
          type: AccountType.BANK,
          template: { type: 'institutional', templateId: 'ffcb7fbd-38bb-4148-83ed-8475b110b6fa' },
        }),
      ).rejects.toBeInstanceOf(AccountTemplateNotFoundError);

      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('rejects mixed new and legacy visual fields before opening a transaction', async () => {
      await expect(
        useCase.execute({
          userId,
          name: 'Nubank',
          type: AccountType.BANK,
          template: { type: 'institutional', templateId: '2ab28159-d4e6-41b0-ab28-728b9b6a8f9c' },
          color: ColorToken.PURPLE,
        }),
      ).rejects.toBeInstanceOf(AccountTemplateInputConflictError);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(accountRepository.save).not.toHaveBeenCalled();
      expect(templateRepository.save).not.toHaveBeenCalled();
    });
  });
});

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
    '2ab28159-d4e6-41b0-ab28-728b9b6a8f9c',
  );
}

function customTemplate(): AccountTemplate {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return AccountTemplate.reconstitute(
    {
      type: ACCOUNT_TEMPLATE_TYPE.CUSTOM,
      ownerUserId: '7959495d-7c8a-451d-b308-da032c20e615',
      catalogKey: null,
      name: 'Custom',
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
