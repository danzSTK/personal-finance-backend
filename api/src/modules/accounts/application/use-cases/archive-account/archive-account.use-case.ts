import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ArchiveAccountUseCaseInput } from './archive-account.dto';

@Injectable()
export class ArchiveAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: ArchiveAccountUseCaseInput): Promise<void> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.isDefault) {
      throw new ConflictException('Default account cannot be archived');
    }

    const hasFutureTransactions = await this.accountRepository.hasFutureScheduledTransactions(
      data.accountId,
      data.userId,
      new Date(),
    );

    if (hasFutureTransactions) {
      throw new ConflictException('Account with scheduled future transactions cannot be archived');
    }

    const hasAnotherActiveAccount = await this.accountRepository.hasAnotherActiveAccount(data.userId, data.accountId);

    if (!hasAnotherActiveAccount) {
      throw new ConflictException('At least one active account must remain');
    }

    account.archive();

    await this.accountRepository.save(account);
  }
}
