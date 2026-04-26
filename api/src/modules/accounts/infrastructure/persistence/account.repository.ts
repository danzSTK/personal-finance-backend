import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountMapper } from '@/modules/accounts/infrastructure/mappers/account.mapper';

@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly accountRepository: Repository<AccountOrmEntity>,
  ) {}

  async findByIdAndUserId(accountId: string, userId: string): Promise<Account | null> {
    const account = await this.accountRepository.findOne({
      where: {
        id: accountId,
        user_id: userId,
      },
    });

    if (!account) {
      return null;
    }

    return AccountMapper.toDomain(account);
  }

  async listByUserId(userId: string, includeArchived: boolean): Promise<Account[]> {
    const accounts = await this.accountRepository.find({
      where: includeArchived ? { user_id: userId } : { user_id: userId, is_archived: false },
      order: {
        is_default: 'DESC',
        created_at: 'ASC',
      },
    });

    return accounts.map(account => AccountMapper.toDomain(account));
  }

  async save(account: Account): Promise<Account> {
    const payload = AccountMapper.toOrm(account);
    await this.accountRepository.save(payload);

    const saved = await this.accountRepository.findOne({
      where: {
        id: account.id,
      },
    });

    if (!saved) {
      throw new Error('Account not found after save');
    }

    return AccountMapper.toDomain(saved);
  }

  async unsetDefaultAccount(userId: string): Promise<void> {
    await this.accountRepository
      .createQueryBuilder()
      .update(AccountOrmEntity)
      .set({ is_default: false })
      .where('user_id = :userId', { userId })
      .execute();
  }

  async userHasDefaultAccount(userId: string): Promise<boolean> {
    const account = await this.accountRepository.findOne({
      where: {
        user_id: userId,
        is_default: true,
        is_archived: false,
      },
      select: ['id'],
    });

    return account !== null;
  }

  async hasAnotherActiveAccount(userId: string, excludeAccountId: string): Promise<boolean> {
    const count = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.user_id = :userId', { userId })
      .andWhere('account.is_archived = false')
      .andWhere('account.id <> :excludeAccountId', { excludeAccountId })
      .getCount();

    return count > 0;
  }

  hasFutureScheduledTransactions(accountId: string, userId: string, referenceDate: Date): Promise<boolean> {
    void accountId;
    void userId;
    void referenceDate;
    return Promise.resolve(false);
  }
}
