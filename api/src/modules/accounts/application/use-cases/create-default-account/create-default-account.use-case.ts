import { AccountType } from '@/common/models/enums';
import { isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { CreateDefaultAccountUseCaseInput } from '@/modules/accounts/application/use-cases/create-default-account/create-default-account.dto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountFactory } from '@/modules/accounts/domain/factories/account.factory';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';

const UNIQUE_CASH_ACCOUNT_PER_USER_CONSTRAINT = 'UQ_accounts_user_cash';

@Injectable()
export class CreateDefaultAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: CreateDefaultAccountUseCaseInput): Promise<Account> {
    const existingCashAccount = await this.findExistingCashAccount(data.userId);

    if (existingCashAccount) {
      return existingCashAccount;
    }

    const account = AccountFactory.createDefaultCashAccount(data.userId);

    try {
      return await this.accountRepository.save(account);
    } catch (error) {
      if (!isPostgresUniqueViolation(error, UNIQUE_CASH_ACCOUNT_PER_USER_CONSTRAINT)) {
        throw error;
      }

      const cashAccountCreatedConcurrently = await this.findExistingCashAccount(data.userId);

      if (cashAccountCreatedConcurrently) {
        return cashAccountCreatedConcurrently;
      }

      throw error;
    }
  }

  private async findExistingCashAccount(userId: string): Promise<Account | null> {
    const existingCashAccounts = await this.accountRepository.findByUserIdAndType(userId, AccountType.CASH);

    return existingCashAccounts?.[0] ?? null;
  }
}
