import { AccountType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { AccountMapper } from '@/modules/accounts/infrastructure/mappers/account.mapper';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly accountRepository: Repository<AccountOrmEntity>,
  ) {}

  async findByUserIdAndType(
    userId: string,
    type: AccountType,
    options?: IRepositoryOptions,
  ): Promise<Account[] | null> {
    const repository = options?.manager ? options.manager.getRepository(AccountOrmEntity) : this.accountRepository;

    const accountOrm = await repository.find({
      where: {
        user_id: userId,
        account_type: type,
      },
    });

    if (!accountOrm) {
      return null;
    }

    return accountOrm.map(account => AccountMapper.toDomain(account));
  }

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
      ? options.manager.getRepository(TransactionOrmEntity)
      : this.accountRepository.manager.getRepository(TransactionOrmEntity);
    const referenceDateAsString = referenceDate.toISOString().slice(0, 10);

    const count = await repository
      .createQueryBuilder('transaction')
      .where(
        new Brackets(queryBuilder => {
          queryBuilder
            .where('transaction.account_id = :accountId', { accountId })
            .orWhere('transaction.destination_account_id = :accountId', { accountId });
        }),
      )
      .andWhere('transaction.user_id = :userId', { userId })
      .andWhere('transaction.deleted_at IS NULL')
      .andWhere('transaction.status = :status', { status: 'PENDING' })
      .andWhere('transaction.date > :referenceDateAsString', { referenceDateAsString })
      .getCount();

    return count > 0;
  }
}
