import { UnarchiveAccountUseCaseInput } from '@/modules/accounts/application/use-cases/unarchive-account/unarchive-account.dto';
import { AccountNotArchivedError, AccountNotFoundError } from '@/modules/accounts/application/errors';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UnarchiveAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: UnarchiveAccountUseCaseInput): Promise<void> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (!account.isArchived) {
      throw new AccountNotArchivedError();
    }

    account.unarchive();

    await this.accountRepository.save(account);
  }
}
