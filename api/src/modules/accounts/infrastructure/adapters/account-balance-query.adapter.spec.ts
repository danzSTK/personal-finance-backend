/* eslint-disable @typescript-eslint/unbound-method */
import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { AccountBalanceQueryAdapter } from '@/modules/accounts/infrastructure/adapters/account-balance-query.adapter';
import { EntityManager } from 'typeorm';

describe('AccountBalanceQueryAdapter', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';

  let adapter: AccountBalanceQueryAdapter;
  let accountBalanceRepository: jest.Mocked<IAccountBalanceRepository>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    manager = {} as unknown as jest.Mocked<EntityManager>;
    accountBalanceRepository = {
      getSummaries: jest.fn(),
      getUserSummary: jest.fn(),
    } as unknown as jest.Mocked<IAccountBalanceRepository>;

    adapter = new AccountBalanceQueryAdapter(accountBalanceRepository);
  });

  it('returns currentCents from account balance summary propagating repository options', async () => {
    accountBalanceRepository.getSummaries.mockResolvedValue([{ accountId, currentCents: -4250 }]);

    const result = await adapter.getCurrentBalanceCents({ userId, accountId }, { manager });

    expect(accountBalanceRepository.getSummaries).toHaveBeenCalledWith(
      { userId, accountIds: [accountId] },
      { manager },
    );
    expect(result).toBe(-4250);
  });

  it('returns null when account summary is not found', async () => {
    accountBalanceRepository.getSummaries.mockResolvedValue([]);

    const result = await adapter.getCurrentBalanceCents({ userId, accountId });

    expect(result).toBeNull();
  });
});
