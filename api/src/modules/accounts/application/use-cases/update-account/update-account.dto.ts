import { Account } from '@/modules/accounts/domain/entities/account.entity';

export interface UpdateAccountPatch {
  name?: Account['name'];
  type?: Account['type'];
  color?: Account['color'];
  icon?: Account['icon'];
  includeInTotal?: Account['includeInTotal'];
}

export interface UpdateAccountUseCaseInput {
  userId: string;
  accountId: string;
  patch: UpdateAccountPatch;
}

export type UpdateAccountUseCaseOutput = Account;
