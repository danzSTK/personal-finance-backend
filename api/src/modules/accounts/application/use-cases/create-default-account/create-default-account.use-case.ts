import { AccountType } from '@/common/models/enums';
import { CreateDefaultAccountUseCaseInput } from '@/modules/accounts/application/use-cases/create-default-account/create-default-account.dto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountFactory } from '@/modules/accounts/domain/factories/account.factory';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateDefaultAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: CreateDefaultAccountUseCaseInput): Promise<Account> {
    const existingCashAccounts = await this.accountRepository.findByUserIdAndType(data.userId, AccountType.CASH);

    if (existingCashAccounts && existingCashAccounts.length > 0) {
      return existingCashAccounts[0];
    }

    const account = AccountFactory.createFromInput(
      {
        userId: data.userId,
        type: AccountType.CASH,
        name: 'Carteira',
        initialBalance: 0,
        color: null,
        icon: null,
        includeInTotal: true,
      },
      true,
    );

    return this.accountRepository.save(account);
  }
}
