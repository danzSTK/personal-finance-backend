import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountRepository } from '@/modules/accounts/infrastructure/persistence/account.repository';
import { CachedAccountRepository } from './cached-account.repository';

describe('CachedAccountRepository', () => {
  const userId = '7959495d-7c8a-451d-b308-da032c20e615';
  const accountId = '5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2';
  let repository: CachedAccountRepository;
  let cacheGet: jest.Mock;
  let cacheSet: jest.Mock;
  let baseFindById: jest.Mock;
  let baseSave: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheGet = jest.fn();
    cacheSet = jest.fn().mockResolvedValue(undefined);
    const cache = {
      get: cacheGet,
      set: cacheSet,
      del: jest.fn().mockResolvedValue(undefined),
    } as unknown as RedisService;
    baseFindById = jest.fn();
    baseSave = jest.fn();
    const baseRepository = {
      findByIdAndUserId: baseFindById,
      save: baseSave,
      listByUserId: jest.fn().mockResolvedValue([]),
    } as unknown as AccountRepository;

    repository = new CachedAccountRepository(baseRepository, cache);
  });

  describe('findByIdAndUserId', () => {
    it('hydrates a v0.3 cache entry without templateId and preserves legacy fields', async () => {
      cacheGet.mockResolvedValue({
        id: accountId,
        userId,
        name: 'Conta legada',
        type: AccountType.BANK,
        initialBalanceCents: 0,
        color: ColorToken.PURPLE,
        icon: IconKey.WALLET,
        includeInTotal: true,
        isArchived: false,
        isDefault: false,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
      });

      const account = await repository.findByIdAndUserId(accountId, userId);

      expect(account?.templateId).toBeNull();
      expect(account?.color).toBe(ColorToken.PURPLE);
      expect(account?.icon).toBe(IconKey.WALLET);
      expect(baseFindById).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('keeps legacy fields and adds templateId to cache entries written by the new image', async () => {
      const account = accountFixture();
      baseSave.mockResolvedValue(account);

      await repository.save(account);

      expect(cacheSet).toHaveBeenCalledWith(
        CacheKeys.accounts.byId(account.id),
        expect.objectContaining({
          templateId: account.templateId,
          color: account.color,
          icon: account.icon,
        }),
        300000,
      );
    });
  });
});

function accountFixture(): Account {
  const now = new Date('2026-08-29T00:00:00.000Z');
  return Account.reconstitute(
    {
      userId: '7959495d-7c8a-451d-b308-da032c20e615',
      name: 'Conta nova',
      type: AccountType.BANK,
      initialBalanceCents: 0,
      templateId: '54066cca-075e-4300-923b-f5b36462aa1f',
      color: 'nubank',
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
