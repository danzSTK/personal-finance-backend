import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import {
  AccountBalanceLockPort,
  LockAccountsForBalanceMutationInput,
} from '@/modules/accounts/application/ports/account-balance-lock.port';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountBalanceLockAdapter implements AccountBalanceLockPort {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async lockAccountsForBalanceMutation(
    input: LockAccountsForBalanceMutationInput,
    options: Required<IRepositoryOptions>,
  ): Promise<void> {
    if (input.accountIds.length === 0) {
      return;
    }

    await this.accountRepository.findByIdsAndUserIdForUpdate(input.accountIds, input.userId, options);
  }
}
