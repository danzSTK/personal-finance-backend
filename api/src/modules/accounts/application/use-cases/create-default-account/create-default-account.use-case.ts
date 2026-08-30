import { AccountType } from '@/common/models/enums';
import { getPostgresConstraintName, isPostgresUniqueViolation } from '@/common/utils/database-errors';
import { CreateDefaultAccountUseCaseInput } from '@/modules/accounts/application/use-cases/create-default-account/create-default-account.dto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountFactory } from '@/modules/accounts/domain/factories/account.factory';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountTemplateFactory } from '@/modules/accounts/domain/factories/account-template.factory';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { IAccountCacheInvalidator } from '@/modules/accounts/application/ports/account-cache-invalidator.interface';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

const UNIQUE_CASH_ACCOUNT_PER_USER_CONSTRAINT = 'UQ_accounts_user_cash';

@Injectable()
export class CreateDefaultAccountUseCase {
  private readonly logger = new Logger(CreateDefaultAccountUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accountRepository: IAccountRepository,
    private readonly accountTemplateRepository: IAccountTemplateRepository,
    private readonly accountCacheInvalidator: IAccountCacheInvalidator,
  ) {}

  async execute(data: CreateDefaultAccountUseCaseInput): Promise<Account> {
    const existingCashAccount = await this.findExistingCashAccount(data.userId);

    if (existingCashAccount) {
      return existingCashAccount;
    }

    try {
      const account = await this.dataSource.transaction(manager => this.createInTransaction(data.userId, manager));
      await this.invalidateCache(data.userId);
      return account;
    } catch (error) {
      if (
        !isPostgresUniqueViolation(error) ||
        getPostgresConstraintName(error) !== UNIQUE_CASH_ACCOUNT_PER_USER_CONSTRAINT
      ) {
        throw error;
      }

      const cashAccountCreatedConcurrently = await this.findExistingCashAccount(data.userId);

      if (cashAccountCreatedConcurrently) {
        return cashAccountCreatedConcurrently;
      }

      throw error;
    }
  }

  private async createInTransaction(userId: string, manager: EntityManager): Promise<Account> {
    const options = { manager };
    const existing = await this.findExistingCashAccount(userId, manager);

    if (existing) {
      return existing;
    }

    const account = AccountFactory.createDefaultCashAccount(userId);
    const custom = AccountTemplateFactory.createCustom({
      ownerUserId: userId,
      name: account.name,
      colorToken: null,
      iconKey: null,
    });
    const savedTemplate = await this.accountTemplateRepository.save(custom, options);
    account.changeTemplate(savedTemplate.id, null, null);
    return this.accountRepository.save(account, options);
  }

  private async findExistingCashAccount(userId: string, manager?: EntityManager): Promise<Account | null> {
    const existingCashAccounts = await this.accountRepository.findByUserIdAndType(
      userId,
      AccountType.CASH,
      manager ? { manager } : undefined,
    );

    return existingCashAccounts?.[0] ?? null;
  }

  private async invalidateCache(userId: string): Promise<void> {
    try {
      await this.accountCacheInvalidator.invalidateUserAccounts(userId);
    } catch (error) {
      this.logger.error(
        `Default account created but cache invalidation failed userId=${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
