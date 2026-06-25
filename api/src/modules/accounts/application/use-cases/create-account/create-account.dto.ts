import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';

export interface CreateAccountUseCaseInput {
  userId: string;
  name: string;
  type: AccountType;
  initialBalanceCents?: number;
  color?: ColorToken | null;
  icon?: IconKey | null;
  includeInTotal?: boolean;
  isDefault?: boolean;
}

export type CreateAccountUseCaseOutput = Account;
