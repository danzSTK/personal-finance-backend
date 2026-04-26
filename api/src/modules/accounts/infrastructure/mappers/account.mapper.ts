import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { Account } from '@/modules/accounts/domain/entities/account.entity';

export class AccountMapper {
  static toDomain(entity: AccountOrmEntity): Account {
    return Account.reconstitute(
      {
        userId: entity.user_id,
        name: entity.name,
        type: entity.account_type,
        initialBalance: Number(entity.initial_balance),
        color: entity.color,
        icon: entity.icon,
        includeInTotal: entity.include_in_total,
        isArchived: entity.is_archived,
        isDefault: entity.is_default,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  static toOrm(account: Account): Partial<AccountOrmEntity> {
    return {
      id: account.id,
      user_id: account.userId,
      name: account.name,
      account_type: account.type,
      initial_balance: account.initialBalance,
      color: account.color,
      icon: account.icon,
      include_in_total: account.includeInTotal,
      is_archived: account.isArchived,
      is_default: account.isDefault,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
    };
  }
}
