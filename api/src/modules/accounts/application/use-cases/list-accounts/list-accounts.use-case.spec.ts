/* eslint-disable @typescript-eslint/unbound-method */
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { ListAccountsUseCase } from './list-accounts.use-case';

describe('ListAccountsUseCase', () => {
  const userId = '7959495d-7c8a-451d-b308-da032c20e615';
  let useCase: ListAccountsUseCase;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let balanceRepository: jest.Mocked<IAccountBalanceRepository>;
  let templateRepository: jest.Mocked<IAccountTemplateRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    accountRepository = {
      findByIdAndUserId: jest.fn(),
      listByUserId: jest.fn(),
      findWithoutTemplateForUpdate: jest.fn(),
      save: jest.fn(),
      unsetDefaultAccount: jest.fn(),
      userHasDefaultAccount: jest.fn(),
      hasAnotherActiveAccount: jest.fn(),
      hasFutureScheduledTransactions: jest.fn(),
      findByUserIdAndType: jest.fn(),
    };
    balanceRepository = {
      getSummaries: jest.fn().mockResolvedValue([]),
      getUserSummary: jest.fn(),
    };
    templateRepository = {
      findActiveInstitutionalById: jest.fn(),
      findByIdsForRendering: jest.fn().mockResolvedValue([]),
      listActiveInstitutional: jest.fn(),
      findInstitutionalByCatalogKey: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListAccountsUseCase,
        { provide: IAccountRepository, useValue: accountRepository },
        { provide: IAccountBalanceRepository, useValue: balanceRepository },
        { provide: IAccountTemplateRepository, useValue: templateRepository },
      ],
    }).compile();
    useCase = module.get(ListAccountsUseCase);
  });

  describe('execute', () => {
    it('loads balances and templates in batches and correlates them in memory', async () => {
      const template = institutionalTemplate();
      const account = accountFixture(template.id);
      accountRepository.listByUserId.mockResolvedValue([account]);
      balanceRepository.getSummaries.mockResolvedValue([{ accountId: account.id, currentCents: 1200 }]);
      templateRepository.findByIdsForRendering.mockResolvedValue([template]);

      const output = await useCase.execute({ userId });

      expect(balanceRepository.getSummaries).toHaveBeenCalledTimes(1);
      expect(templateRepository.findByIdsForRendering).toHaveBeenCalledWith([template.id], userId);
      expect(output).toEqual([
        {
          account,
          template,
          balance: { accountId: account.id, currentCents: 1200 },
        },
      ]);
    });

    it('keeps a v0.3 row readable while template_id is still null', async () => {
      const account = accountFixture(null);
      accountRepository.listByUserId.mockResolvedValue([account]);

      const projectedUntil = toDateOnly('2026-09-30');
      const [output] = await useCase.execute({ userId, projectedUntil });

      expect(templateRepository.findByIdsForRendering).toHaveBeenCalledWith([], userId);
      expect(output.template).toBeNull();
      expect(output.account.color).toBe(ColorToken.PURPLE);
      expect(output.balance).toEqual({
        accountId: account.id,
        currentCents: 0,
        projectedCents: 0,
        projectedUntil,
      });
    });
  });
});

function accountFixture(templateId: string | null): Account {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return Account.reconstitute(
    {
      userId: '7959495d-7c8a-451d-b308-da032c20e615',
      name: 'Nubank',
      type: AccountType.BANK,
      initialBalanceCents: 0,
      templateId,
      color: ColorToken.PURPLE,
      icon: IconKey.LANDMARK,
      includeInTotal: true,
      isArchived: false,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    },
    '5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2',
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
      isActive: false,
      createdAt: now,
      updatedAt: now,
    },
    '54066cca-075e-4300-923b-f5b36462aa1f',
  );
}
