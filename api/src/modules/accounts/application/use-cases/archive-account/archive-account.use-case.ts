import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import {
  AccountHasScheduledTransactionsError,
  AccountMustRemainActiveError,
  AccountNotFoundError,
} from '@/modules/accounts/application/errors';
import { AccountCannotBeArchivedError } from '@/modules/accounts/domain/errors';
import { Injectable } from '@nestjs/common';
import { ArchiveAccountUseCaseInput } from './archive-account.dto';

@Injectable()
export class ArchiveAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: ArchiveAccountUseCaseInput): Promise<void> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.isDefault) {
      throw new AccountCannotBeArchivedError('Default account cannot be archived.');
    }

    const hasFutureTransactions = await this.accountRepository.hasFutureScheduledTransactions(
      data.accountId,
      data.userId,
      new Date(),
    );

    if (hasFutureTransactions) {
      throw new AccountHasScheduledTransactionsError();
    }

    const hasAnotherActiveAccount = await this.accountRepository.hasAnotherActiveAccount(data.userId, data.accountId);

    if (!hasAnotherActiveAccount) {
      throw new AccountMustRemainActiveError();
    }

    account.archive();

    await this.accountRepository.save(account);
  }
}
