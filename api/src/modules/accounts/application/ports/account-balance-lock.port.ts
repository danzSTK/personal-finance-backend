import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';

export interface LockAccountsForBalanceMutationInput {
  userId: string;
  accountIds: readonly string[];
}

export abstract class AccountBalanceLockPort {
  abstract lockAccountsForBalanceMutation(
    input: LockAccountsForBalanceMutationInput,
    options: Required<IRepositoryOptions>,
  ): Promise<void>;
}
