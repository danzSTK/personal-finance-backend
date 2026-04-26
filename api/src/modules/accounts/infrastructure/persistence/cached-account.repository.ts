import { RedisService } from '@/database/redis/redis.service';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CachedAccountRepository implements IAccountRepository {
  constructor(
    private readonly userRepository: IAccountRepository,
    private readonly cache: RedisService,
  ) {}
  private readonly cacheTtl = 1000 * 60 * 5;

  findByIdAndUserId(accountId: string, userId: string): Promise<Account | null> {
    throw new Error('Method not implemented.');
  }
  listByUserId(userId: string, includeArchived: boolean): Promise<Account[]> {
    throw new Error('Method not implemented.');
  }
  save(account: Account): Promise<Account> {
    throw new Error('Method not implemented.');
  }
  unsetDefaultAccount(userId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  userHasDefaultAccount(userId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  hasAnotherActiveAccount(userId: string, excludeAccountId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  hasFutureScheduledTransactions(accountId: string, userId: string, referenceDate: Date): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
