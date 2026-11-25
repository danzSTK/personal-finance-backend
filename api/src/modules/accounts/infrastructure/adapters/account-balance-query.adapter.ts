import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import {
  AccountBalanceQueryPort,
  GetAccountCurrentBalanceInput,
} from '@/modules/accounts/application/ports/account-balance-query.port';
import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountBalanceQueryAdapter implements AccountBalanceQueryPort {
  constructor(private readonly accountBalanceRepository: IAccountBalanceRepository) {}

  async getCurrentBalanceCents(
    input: GetAccountCurrentBalanceInput,
    options?: IRepositoryOptions,
  ): Promise<number | null> {
    const [summary] = await this.accountBalanceRepository.getSummaries(
      {
        userId: input.userId,
        accountIds: [input.accountId],
      },
      options,
    );

    return summary ? summary.currentCents : null;
  }
}
