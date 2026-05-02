import { AccountType } from '@/common/models/enums/account-type.enum';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';
import { AccountRepository } from './account.repository';

interface CachedAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string | null;
  icon: string | null;
  includeInTotal: boolean;
  isArchived: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CachedAccountRepository implements IAccountRepository {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly cache: RedisService,
  ) {}

  private readonly cacheTtl = 1000 * 60 * 5;

  async findByIdAndUserId(accountId: string, userId: string, options?: IRepositoryOptions): Promise<Account | null> {
    if (options?.manager) {
      return this.accountRepository.findByIdAndUserId(accountId, userId, { manager: options.manager });
    }

    const cacheKey = CacheKeys.accounts.byId(accountId);
    const cached = await this.cache.get<CachedAccount>(cacheKey);

    if (cached) {
      if (cached.userId !== userId) {
        return null;
      }

      return this.hydrateAccount(cached);
    }

    const account = await this.accountRepository.findByIdAndUserId(accountId, userId);

    if (!account) {
      return null;
    }

    await this.cache.set(cacheKey, this.serializeAccount(account), this.cacheTtl);

    return account;
  }

  async listByUserId(userId: string, includeArchived: boolean, options?: IRepositoryOptions): Promise<Account[]> {
    if (options?.manager) {
      return this.accountRepository.listByUserId(userId, includeArchived, { manager: options.manager });
    }

    const cacheKey = CacheKeys.accounts.listByUserId(userId, includeArchived);
    const cached = await this.cache.get<CachedAccount[]>(cacheKey);

    if (cached) {
      return cached.map(account => this.hydrateAccount(account));
    }

    const accounts = await this.accountRepository.listByUserId(userId, includeArchived);
    const serializedAccounts = accounts.map(account => this.serializeAccount(account));

    await Promise.all([
      this.cache.set(cacheKey, serializedAccounts, this.cacheTtl),
      ...serializedAccounts.map(account => this.cache.set(CacheKeys.accounts.byId(account.id), account, this.cacheTtl)),
    ]);

    return accounts;
  }

  async save(account: Account, options?: IRepositoryOptions): Promise<Account> {
    const saved = await this.accountRepository.save(account, options);

    await this.invalidateUserAccountCache(saved.userId, options);
    await this.cache.set(CacheKeys.accounts.byId(saved.id), this.serializeAccount(saved), this.cacheTtl);

    return saved;
  }

  async unsetDefaultAccount(userId: string, options?: IRepositoryOptions): Promise<void> {
    await this.accountRepository.unsetDefaultAccount(userId, options);
    await this.invalidateUserAccountCache(userId, options);
  }

  async userHasDefaultAccount(userId: string, options?: IRepositoryOptions): Promise<boolean> {
    if (options?.manager) {
      return this.accountRepository.userHasDefaultAccount(userId, { manager: options.manager });
    }

    const accounts = await this.listByUserId(userId, false);

    return accounts.some(account => account.isDefault);
  }

  async hasAnotherActiveAccount(
    userId: string,
    excludeAccountId: string,
    options?: IRepositoryOptions,
  ): Promise<boolean> {
    if (options?.manager) {
      return this.accountRepository.hasAnotherActiveAccount(userId, excludeAccountId, { manager: options.manager });
    }

    const accounts = await this.listByUserId(userId, false);

    return accounts.some(account => account.id !== excludeAccountId);
  }

  async hasFutureScheduledTransactions(
    accountId: string,
    userId: string,
    referenceDate: Date,
    options?: IRepositoryOptions,
  ): Promise<boolean> {
    return this.accountRepository.hasFutureScheduledTransactions(accountId, userId, referenceDate, options);
  }

  private serializeAccount(account: Account): CachedAccount {
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      initialBalance: account.initialBalance,
      color: account.color,
      icon: account.icon,
      includeInTotal: account.includeInTotal,
      isArchived: account.isArchived,
      isDefault: account.isDefault,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private hydrateAccount(cached: CachedAccount): Account {
    return Account.reconstitute(
      {
        userId: cached.userId,
        name: cached.name,
        type: cached.type,
        initialBalance: cached.initialBalance,
        color: cached.color,
        icon: cached.icon,
        includeInTotal: cached.includeInTotal,
        isArchived: cached.isArchived,
        isDefault: cached.isDefault,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
      },
      cached.id,
    );
  }

  private async invalidateUserAccountCache(userId: string, options?: IRepositoryOptions): Promise<void> {
    const accounts = await this.accountRepository.listByUserId(userId, true, options);

    await Promise.all([
      this.cache.del(CacheKeys.accounts.listByUserId(userId, false)),
      this.cache.del(CacheKeys.accounts.listByUserId(userId, true)),
      ...accounts.map(account => this.cache.del(CacheKeys.accounts.byId(account.id))),
    ]);
  }
}
