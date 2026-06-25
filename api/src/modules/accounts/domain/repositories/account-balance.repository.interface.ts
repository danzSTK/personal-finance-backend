export interface AccountBalanceSummary {
  accountId: string;
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: Date;
}

export interface GetAccountBalanceSummariesInput {
  userId: string;
  accountIds: string[];
  projectedUntil?: Date;
}

export abstract class IAccountBalanceRepository {
  abstract getSummaries(input: GetAccountBalanceSummariesInput): Promise<AccountBalanceSummary[]>;
}
