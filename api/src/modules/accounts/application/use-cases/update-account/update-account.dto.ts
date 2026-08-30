import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { AccountTemplateInput } from '@/modules/accounts/application/models/account-template-input';

export interface UpdateAccountPatch {
  template?: AccountTemplateInput;
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

export interface UpdateAccountUseCaseOutput {
  account: Account;
  template: AccountTemplate;
}
