import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { Injectable } from '@nestjs/common';
import { type ListAccountsUseCaseInput, ListAccountsUseCaseOutput } from './list-accounts.dto';

@Injectable()
export class ListAccountsUseCase {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly accountBalanceRepository: IAccountBalanceRepository,
  ) {}

  async execute(data: ListAccountsUseCaseInput): Promise<ListAccountsUseCaseOutput> {
    const accounts = await this.accountRepository.listByUserId(data.userId, data.includeArchived ?? false);
    const balances = await this.accountBalanceRepository.getSummaries({
      userId: data.userId,
      accountIds: accounts.map(account => account.id),
      projectedUntil: data.projectedUntil,
    });
    const balanceByAccountId = new Map(balances.map(balance => [balance.accountId, balance]));

    return accounts.map(account => ({
      account,
      balance: balanceByAccountId.get(account.id) ?? {
        accountId: account.id,
        currentCents: account.initialBalanceCents,
        projectedCents: data.projectedUntil ? account.initialBalanceCents : undefined,
        projectedUntil: data.projectedUntil,
      },
    }));
  }
}
