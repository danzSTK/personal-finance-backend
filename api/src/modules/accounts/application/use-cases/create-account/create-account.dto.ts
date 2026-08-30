import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { AccountTemplateInput } from '@/modules/accounts/application/models/account-template-input';

export interface CreateAccountUseCaseInput {
  userId: string;
  name: string;
  type: AccountType;
  initialBalanceCents?: number;
  template?: AccountTemplateInput;
  color?: ColorToken | null;
  icon?: IconKey | null;
  includeInTotal?: boolean;
  isDefault?: boolean;
}

export interface CreateAccountUseCaseOutput {
  account: Account;
  template: AccountTemplate;
}
