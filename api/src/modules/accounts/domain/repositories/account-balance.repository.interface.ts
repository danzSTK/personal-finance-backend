import { DateOnlyString } from '@/common/utils/date-only';

export interface AccountBalanceSummary {
  accountId: string;
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: DateOnlyString;
}

export interface AccountSummary {
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: DateOnlyString;
}

export interface GetAccountBalanceSummariesInput {
  userId: string;
  accountIds: string[];
  projectedUntil?: DateOnlyString;
}

export interface GetAccountSummaryInput {
  userId: string;
  includeArchived?: boolean;
  includeExcludedFromTotal?: boolean;
  projectedUntil?: DateOnlyString;
}

export abstract class IAccountBalanceRepository {
  abstract getSummaries(input: GetAccountBalanceSummariesInput): Promise<AccountBalanceSummary[]>;
  abstract getUserSummary(input: GetAccountSummaryInput): Promise<AccountSummary>;
}
