import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { AccountTemplateOrmEntity } from '@/modules/accounts/infrastructure/persistence/account-template-orm.entity';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { EmailMessageOrmEntity } from '@/modules/notifications/infrastructure/persistence/email-message-orm.entity';
import { EmailVerificationChallengeOrmEntity } from '@/modules/auth/infrastructure/persistence/email-verification-challenge-orm.entity';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { CategoryOrmEntity } from '../modules/categories/infrastructure/persistence/model/category.entity';
import { AuthProviderOrmEntity } from '../modules/users/infrastructure/persistence/auth-provider-orm.entity';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user-orm-entity';
import { OutboxMessageOrmEntity } from '../shared/outbox';

export const ENTITIES = [
  UserOrmEntity,
  AuthProviderOrmEntity,
  AccountOrmEntity,
  AccountTemplateOrmEntity,
  AssetOrmEntity,
  CategoryOrmEntity,
  TransactionOrmEntity,
  EmailMessageOrmEntity,
  EmailVerificationChallengeOrmEntity,
  PasswordChangeEventOrmEntity,
  OutboxMessageOrmEntity,
];
