import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';

export interface GetAccountCurrentBalanceInput {
  userId: string;
  accountId: string;
}

export abstract class AccountBalanceQueryPort {
  abstract getCurrentBalanceCents(
    input: GetAccountCurrentBalanceInput,
    options?: IRepositoryOptions,
  ): Promise<number | null>;
}
