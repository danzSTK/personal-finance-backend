import { AccountType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { DateOnlyString } from '@/common/utils/date-only';
import { Account } from '../entities/account.entity';

export abstract class IAccountRepository {
  abstract findByIdAndUserId(accountId: string, userId: string, options?: IRepositoryOptions): Promise<Account | null>;
  abstract listByUserId(userId: string, includeArchived: boolean, options?: IRepositoryOptions): Promise<Account[]>;
  abstract save(account: Account, options?: IRepositoryOptions): Promise<Account>;
  abstract unsetDefaultAccount(userId: string, options?: IRepositoryOptions): Promise<void>;
  abstract userHasDefaultAccount(userId: string, options?: IRepositoryOptions): Promise<boolean>;
  abstract hasAnotherActiveAccount(
    userId: string,
    excludeAccountId: string,
    options?: IRepositoryOptions,
  ): Promise<boolean>;
  abstract hasFutureScheduledTransactions(
    accountId: string,
    userId: string,
    referenceDate: DateOnlyString,
    options?: IRepositoryOptions,
  ): Promise<boolean>;

  abstract findByUserIdAndType(
    userId: string,
    type: AccountType,
    options?: IRepositoryOptions,
  ): Promise<Account[] | null>;
}
