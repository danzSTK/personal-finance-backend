import { AccountType } from '@/common/models/enums/account-type.enum';

export interface CreateAccountUseCaseDto {
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color?: string | null;
  icon?: string | null;
  includeInTotal?: boolean;
  isDefault?: boolean;
}
