/* eslint-disable @typescript-eslint/unbound-method */
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountBalanceLockAdapter } from '@/modules/accounts/infrastructure/adapters/account-balance-lock.adapter';
import { EntityManager } from 'typeorm';

describe('AccountBalanceLockAdapter', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountA = '22222222-2222-4222-a222-222222222222';
  const accountB = '33333333-3333-4333-a333-333333333333';

  let adapter: AccountBalanceLockAdapter;
  let accountRepository: jest.Mocked<IAccountRepository>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    manager = {} as unknown as jest.Mocked<EntityManager>;
    accountRepository = {
      findByIdAndUserId: jest.fn(),
      findByIdsAndUserIdForUpdate: jest.fn().mockResolvedValue([]),
      listByUserId: jest.fn(),
      findWithoutTemplateForUpdate: jest.fn(),
      save: jest.fn(),
      unsetDefaultAccount: jest.fn(),
      userHasDefaultAccount: jest.fn(),
      hasAnotherActiveAccount: jest.fn(),
      hasFutureScheduledTransactions: jest.fn(),
      findByUserIdAndType: jest.fn(),
    } as unknown as jest.Mocked<IAccountRepository>;

    adapter = new AccountBalanceLockAdapter(accountRepository);
  });

  it('delegates non-empty accountIds to IAccountRepository.findByIdsAndUserIdForUpdate', async () => {
    await adapter.lockAccountsForBalanceMutation({ userId, accountIds: [accountB, accountA] }, { manager });

    expect(accountRepository.findByIdsAndUserIdForUpdate).toHaveBeenCalledWith([accountB, accountA], userId, {
      manager,
    });
  });

  it('is a no-op when accountIds is empty', async () => {
    await adapter.lockAccountsForBalanceMutation({ userId, accountIds: [] }, { manager });

    expect(accountRepository.findByIdsAndUserIdForUpdate).not.toHaveBeenCalled();
  });
});
