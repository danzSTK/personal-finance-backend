import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { Category } from '../entities/category.entity';
import { Transaction } from '../entities/transaction.entity';
import { AuthProviderOrmEntity } from '../modules/users/infrastructure/persistence/auth-provider-orm.entity';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user-orm-entity';
import { OutboxMessageOrmEntity } from '../shared/outbox';

export const ENTITIES = [
  UserOrmEntity,
  AuthProviderOrmEntity,
  AccountOrmEntity,
  Category,
  Transaction,
  OutboxMessageOrmEntity,
];
