import {
  AccountBalanceSummary,
  AccountSummary,
  GetAccountBalanceSummariesInput,
  GetAccountSummaryInput,
  IAccountBalanceRepository,
} from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface AccountBalanceRow {
  account_id: string;
  current_cents: string;
  projected_cents: string | null;
}

interface AccountSummaryRow {
  current_cents: string;
  projected_cents: string | null;
}

@Injectable()
export class AccountBalanceRepository implements IAccountBalanceRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getSummaries(input: GetAccountBalanceSummariesInput): Promise<AccountBalanceSummary[]> {
    if (input.accountIds.length === 0) {
      return [];
    }

    const projectedUntil = input.projectedUntil ?? null;

    const rows = await this.dataSource.query<AccountBalanceRow[]>(
      `
        WITH target_accounts AS (
          SELECT
            "id",
            "initial_balance_cents"
          FROM "accounts"
          WHERE "user_id" = $1
            AND "id" = ANY($2::uuid[])
        ),
        movement_deltas AS (
          SELECT
            tx."account_id" AS "account_id",
            SUM(
              CASE
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'INCOME'
                  THEN tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'EXPENSE'
                  THEN -tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'TRANSFER'
                  THEN -tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'INCREASE'
                  THEN tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'DECREASE'
                  THEN -tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "current_delta_cents",
            SUM(
              CASE
                WHEN $3::date IS NULL OR tx."date" > $3::date
                  THEN 0
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'INCOME'
                  THEN tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'EXPENSE'
                  THEN -tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'TRANSFER'
                  THEN -tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'INCREASE'
                  THEN tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'DECREASE'
                  THEN -tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "projected_delta_cents"
          FROM "transactions" tx
          INNER JOIN target_accounts account ON account."id" = tx."account_id"
          WHERE tx."user_id" = $1
            AND tx."deleted_at" IS NULL
          GROUP BY tx."account_id"

          UNION ALL

          SELECT
            tx."destination_account_id" AS "account_id",
            SUM(
              CASE
                WHEN tx."status" = 'EFFECTIVE'
                  THEN tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "current_delta_cents",
            SUM(
              CASE
                WHEN $3::date IS NULL OR tx."date" > $3::date
                  THEN 0
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING')
                  THEN tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "projected_delta_cents"
          FROM "transactions" tx
          INNER JOIN target_accounts account ON account."id" = tx."destination_account_id"
          WHERE tx."user_id" = $1
            AND tx."deleted_at" IS NULL
            AND tx."type" = 'TRANSFER'
            AND tx."destination_account_id" IS NOT NULL
          GROUP BY tx."destination_account_id"
        ),
        aggregated_deltas AS (
          SELECT
            "account_id",
            SUM("current_delta_cents")::bigint AS "current_delta_cents",
            SUM("projected_delta_cents")::bigint AS "projected_delta_cents"
          FROM movement_deltas
          GROUP BY "account_id"
        )
        SELECT
          account."id" AS "account_id",
          (account."initial_balance_cents" + COALESCE(delta."current_delta_cents", 0))::bigint AS "current_cents",
          CASE
            WHEN $3::date IS NULL THEN NULL
            ELSE (account."initial_balance_cents" + COALESCE(delta."projected_delta_cents", 0))::bigint
          END AS "projected_cents"
        FROM target_accounts account
        LEFT JOIN aggregated_deltas delta ON delta."account_id" = account."id"
      `,
      [input.userId, input.accountIds, projectedUntil],
    );

    return rows.map(row => ({
      accountId: row.account_id,
      currentCents: this.toSafeCents(row.current_cents),
      projectedCents: row.projected_cents === null ? undefined : this.toSafeCents(row.projected_cents),
      projectedUntil: input.projectedUntil,
    }));
  }

  async getUserSummary(input: GetAccountSummaryInput): Promise<AccountSummary> {
    const projectedUntil = input.projectedUntil ?? null;
    const includeArchived = input.includeArchived ?? false;
    const includeExcludedFromTotal = input.includeExcludedFromTotal ?? false;

    const rows = await this.dataSource.query<AccountSummaryRow[]>(
      `
        WITH target_accounts AS (
          SELECT
            account."id",
            account."initial_balance_cents"
          FROM "accounts" account
          WHERE account."user_id" = $1
            AND ($2::boolean = true OR account."is_archived" = false)
            AND ($3::boolean = true OR account."include_in_total" = true)
        ),
        movement_deltas AS (
          SELECT
            tx."account_id" AS "account_id",
            SUM(
              CASE
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'INCOME'
                  THEN tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'EXPENSE'
                  THEN -tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'TRANSFER'
                  THEN -tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'INCREASE'
                  THEN tx."amount_cents"
                WHEN tx."status" = 'EFFECTIVE' AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'DECREASE'
                  THEN -tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "current_delta_cents",
            SUM(
              CASE
                WHEN $4::date IS NULL OR tx."date" > $4::date
                  THEN 0
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'INCOME'
                  THEN tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'EXPENSE'
                  THEN -tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'TRANSFER'
                  THEN -tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'INCREASE'
                  THEN tx."amount_cents"
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING') AND tx."type" = 'ADJUSTMENT' AND tx."direction" = 'DECREASE'
                  THEN -tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "projected_delta_cents"
          FROM "transactions" tx
          INNER JOIN target_accounts account ON account."id" = tx."account_id"
          WHERE tx."user_id" = $1
            AND tx."deleted_at" IS NULL
          GROUP BY tx."account_id"

          UNION ALL

          SELECT
            tx."destination_account_id" AS "account_id",
            SUM(
              CASE
                WHEN tx."status" = 'EFFECTIVE'
                  THEN tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "current_delta_cents",
            SUM(
              CASE
                WHEN $4::date IS NULL OR tx."date" > $4::date
                  THEN 0
                WHEN tx."status" IN ('EFFECTIVE', 'PENDING')
                  THEN tx."amount_cents"
                ELSE 0
              END
            )::bigint AS "projected_delta_cents"
          FROM "transactions" tx
          INNER JOIN target_accounts account ON account."id" = tx."destination_account_id"
          WHERE tx."user_id" = $1
            AND tx."deleted_at" IS NULL
            AND tx."type" = 'TRANSFER'
            AND tx."destination_account_id" IS NOT NULL
          GROUP BY tx."destination_account_id"
        ),
        aggregated_deltas AS (
          SELECT
            "account_id",
            SUM("current_delta_cents")::bigint AS "current_delta_cents",
            SUM("projected_delta_cents")::bigint AS "projected_delta_cents"
          FROM movement_deltas
          GROUP BY "account_id"
        )
        SELECT
          COALESCE(SUM(account."initial_balance_cents" + COALESCE(delta."current_delta_cents", 0)), 0)::bigint AS "current_cents",
          CASE
            WHEN $4::date IS NULL THEN NULL
            ELSE COALESCE(SUM(account."initial_balance_cents" + COALESCE(delta."projected_delta_cents", 0)), 0)::bigint
          END AS "projected_cents"
        FROM target_accounts account
        LEFT JOIN aggregated_deltas delta ON delta."account_id" = account."id"
      `,
      [input.userId, includeArchived, includeExcludedFromTotal, projectedUntil],
    );
    const row = rows[0];

    return {
      currentCents: this.toSafeCents(row?.current_cents ?? '0'),
      projectedCents: row?.projected_cents == null ? undefined : this.toSafeCents(row.projected_cents),
      projectedUntil: input.projectedUntil,
    };
  }

  private toSafeCents(value: string): number {
    const cents = Number(value);

    if (!Number.isSafeInteger(cents)) {
      throw new Error('Account balance exceeded safe integer range.');
    }

    return cents;
  }
}
