import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { Transaction } from '@/entities/transaction.entity';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountMapper } from '@/modules/accounts/infrastructure/mappers/account.mapper';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';

@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly accountRepository: Repository<AccountOrmEntity>,
  ) {}

  async findByIdAndUserId(accountId: string, userId: string, options?: IRepositoryOptions): Promise<Account | null> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;

    const account = await repository.findOne({
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

  async listByUserId(userId: string, includeArchived: boolean, options?: IRepositoryOptions): Promise<Account[]> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;

    const accounts = await repository.find({
      where: includeArchived ? { user_id: userId } : { user_id: userId, is_archived: false },
      order: {
        is_default: 'DESC',
        created_at: 'ASC',
      },
    });

    return accounts.map(account => AccountMapper.toDomain(account));
  }

  async save(account: Account, options?: IRepositoryOptions): Promise<Account> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;
    const payload = AccountMapper.toOrm(account);
    await repository.save(payload);

    const saved = await repository.findOne({
      where: {
        id: account.id,
      },
    });

    if (!saved) {
      throw new Error('Account not found after save');
    }

    return AccountMapper.toDomain(saved);
  }

  async unsetDefaultAccount(userId: string, options?: IRepositoryOptions): Promise<void> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;

    await repository
      .createQueryBuilder()
      .update(AccountOrmEntity)
      .set({ is_default: false })
      .where('user_id = :userId', { userId })
      .execute();
  }

  async userHasDefaultAccount(userId: string, options?: IRepositoryOptions): Promise<boolean> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;

    const account = await repository.findOne({
      where: {
        user_id: userId,
        is_default: true,
        is_archived: false,
      },
      select: ['id'],
    });

    return account !== null;
  }

  async hasAnotherActiveAccount(
    userId: string,
    excludeAccountId: string,
    options?: IRepositoryOptions,
  ): Promise<boolean> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;

    const count = await repository
      .createQueryBuilder('account')
      .where('account.user_id = :userId', { userId })
      .andWhere('account.is_archived = false')
      .andWhere('account.id <> :excludeAccountId', { excludeAccountId })
      .getCount();

    return count > 0;
  }

  async hasFutureScheduledTransactions(
    accountId: string,
    userId: string,
    referenceDate: Date,
    options?: IRepositoryOptions,
  ): Promise<boolean> {
    const repository = options?.manager
      ? options.manager.getRepository(Transaction)
      : this.accountRepository.manager.getRepository(Transaction);
    const referenceDateAsString = referenceDate.toISOString().slice(0, 10);

    const count = await repository
      .createQueryBuilder('transaction')
      .where('transaction.account_id = :accountId', { accountId })
      .andWhere('transaction.user_id = :userId', { userId })
      .andWhere('transaction.is_active = true')
      .andWhere('transaction.date > :referenceDateAsString', { referenceDateAsString })
      .getCount();

    return count > 0;
  }
}
