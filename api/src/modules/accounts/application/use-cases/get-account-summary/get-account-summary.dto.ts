import { DateOnlyString } from '@/common/utils/date-only';
import { AccountSummary } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';

export interface GetAccountSummaryUseCaseInput {
  userId: string;
  includeArchived?: boolean;
  includeExcludedFromTotal?: boolean;
  projectedUntil?: DateOnlyString;
}

export type GetAccountSummaryUseCaseOutput = AccountSummary;
