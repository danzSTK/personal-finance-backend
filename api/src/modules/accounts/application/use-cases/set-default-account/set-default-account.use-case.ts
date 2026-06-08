import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountAlreadyDefaultError, AccountNotFoundError } from '@/modules/accounts/application/errors';
import { Injectable } from '@nestjs/common';
import { type SetDefaultAccountUseCaseInput } from './set-default-account.dto';

@Injectable()
export class SetDefaultAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: SetDefaultAccountUseCaseInput): Promise<void> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.isDefault) {
      throw new AccountAlreadyDefaultError();
    }

    account.setAsDefault();
    await this.accountRepository.unsetDefaultAccount(data.userId);
    await this.accountRepository.save(account);
  }
}
