import { Account } from '../entities/account.entity';
import { AuthProvider } from '../entities/auth-provider.entity';
import { Category } from '../entities/category.entity';
import { Transaction } from '../entities/transaction.entity';
import { User } from '../modules/users/entities/user.entity';

export const ENTITIES = [User, Account, Category, Transaction, AuthProvider];
