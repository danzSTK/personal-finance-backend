import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { Transaction } from '../entities/transaction.entity';
import { CategoryOrmEntity } from '../modules/categories/infrastructure/persistence/model/category.entity';
import { AuthProviderOrmEntity } from '../modules/users/infrastructure/persistence/auth-provider-orm.entity';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user-orm-entity';
import { OutboxMessageOrmEntity } from '../shared/outbox';

export const ENTITIES = [
  UserOrmEntity,
  AuthProviderOrmEntity,
  AccountOrmEntity,
  AssetOrmEntity,
  CategoryOrmEntity,
  Transaction,
  OutboxMessageOrmEntity,
];
