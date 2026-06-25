import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { randomUUID } from 'node:crypto';

interface CreateManualAccountInput {
  userId: string;
  name: string;
  type: AccountType;
  initialBalanceCents?: number;
  color?: ColorToken | null;
  icon?: IconKey | null;
  includeInTotal?: boolean;
}

export class AccountFactory {
  static createManualAccount(data: CreateManualAccountInput, shouldSetAsDefault: boolean): Account {
    const now = new Date();

    return Account.create(
      {
        userId: data.userId,
        name: data.name,
        type: data.type,
        initialBalanceCents: data.initialBalanceCents ?? 0,
        color: data.color ?? null,
        icon: data.icon ?? null,
        includeInTotal: data.includeInTotal ?? true,
        isArchived: false,
        isDefault: shouldSetAsDefault,
        createdAt: now,
        updatedAt: now,
      },
      randomUUID(),
    );
  }

  static createDefaultCashAccount(userId: string): Account {
    const now = new Date();

    return Account.create(
      {
        userId,
        name: 'Carteira',
        type: AccountType.CASH,
        initialBalanceCents: 0,
        color: null,
        icon: null,
        includeInTotal: true,
        isArchived: false,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
      randomUUID(),
    );
  }
}
