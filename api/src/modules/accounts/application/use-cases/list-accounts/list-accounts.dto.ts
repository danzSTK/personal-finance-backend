import { DateOnlyString } from '@/common/utils/date-only';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountBalanceSummary } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';

export interface ListAccountsUseCaseInput {
  userId: string;
  includeArchived?: boolean;
  projectedUntil?: DateOnlyString;
}

export interface AccountWithBalance {
  account: Account;
  balance: AccountBalanceSummary;
}

export type ListAccountsUseCaseOutput = AccountWithBalance[];
