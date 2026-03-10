import { Account } from '../entities/account.entity';
import { AuthProvider } from '../modules/auth/entities/auth-provider.entity';
import { Category } from '../entities/category.entity';
import { Transaction } from '../entities/transaction.entity';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user-orm-entity';

export const ENTITIES = [UserOrmEntity, Account, Category, Transaction, AuthProvider];
