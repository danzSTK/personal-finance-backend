import { AccountType } from '@/common/models/enums/account-type.enum';
import { Account } from '@/modules/accounts/domain/entities/account.entity';

export interface CreateAccountUseCaseInput {
  userId: string;
  name: string;
  type: AccountType;
  initialBalance?: number;
  color?: string | null;
  icon?: string | null;
  includeInTotal?: boolean;
  isDefault?: boolean;
}

export type CreateAccountUseCaseOutput = Account;
