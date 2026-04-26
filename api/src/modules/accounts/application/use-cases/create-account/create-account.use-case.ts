import { Injectable } from '@nestjs/common';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountFactory } from '@/modules/accounts/domain/factories/account.factory';
import { type CreateAccountUseCaseDto } from './create-account.dto';

@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: CreateAccountUseCaseDto): Promise<Account> {
    const hasDefaultAccount = await this.accountRepository.userHasDefaultAccount(data.userId);
    const shouldSetAsDefault = data.isDefault === true || !hasDefaultAccount;

    if (shouldSetAsDefault) {
      await this.accountRepository.unsetDefaultAccount(data.userId);
    }

    const account: Account = AccountFactory.createFromInput(data, shouldSetAsDefault);

    return this.accountRepository.save(account);
  }
}
