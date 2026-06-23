import { Account } from '@/modules/accounts/domain/entities/account.entity';

export interface ListAccountsUseCaseInput {
  userId: string;
  includeArchived?: boolean;
}

export type ListAccountsUseCaseOutput = Account[];
