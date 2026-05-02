import {
  CreateAccountUseCaseInput,
  CreateAccountUseCaseOutput,
} from '@/modules/accounts/application/use-cases/create-account/create-account.dto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountFactory } from '@/modules/accounts/domain/factories/account.factory';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: CreateAccountUseCaseInput): Promise<CreateAccountUseCaseOutput> {
    const hasDefaultAccount = await this.accountRepository.userHasDefaultAccount(data.userId);
    const shouldSetAsDefault = data.isDefault === true || !hasDefaultAccount;

    if (shouldSetAsDefault) {
      await this.accountRepository.unsetDefaultAccount(data.userId);
    }

    const account: Account = AccountFactory.createFromInput(data, shouldSetAsDefault);

    return this.accountRepository.save(account);
  }
}
