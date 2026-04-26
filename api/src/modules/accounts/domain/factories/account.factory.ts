import { randomUUID } from 'node:crypto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { type CreateAccountUseCaseDto } from '@/modules/accounts/application/use-cases/create-account/create-account.dto';

export class AccountFactory {
  static createFromInput(data: CreateAccountUseCaseDto, shouldSetAsDefault: boolean): Account {
    const now = new Date();

    return Account.create(
      {
        userId: data.userId,
        name: data.name,
        type: data.type,
        initialBalance: data.initialBalance,
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
}
