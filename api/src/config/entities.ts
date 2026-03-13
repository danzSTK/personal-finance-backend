import { Account } from '../entities/account.entity';
import { Category } from '../entities/category.entity';
import { Transaction } from '../entities/transaction.entity';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user-orm-entity';
import { AuthProviderOrmEntity } from '../modules/users/infrastructure/persistence/auth-provider-orm.entity';

export const ENTITIES = [UserOrmEntity, AuthProviderOrmEntity, Account, Category, Transaction];
