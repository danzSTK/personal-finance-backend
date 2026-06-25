import { UnarchiveAccountUseCase } from '@/modules/accounts/application/use-cases/unarchive-account/unarchive-account.use-case';
import { UpdateAccountUseCase } from '@/modules/accounts/application/use-cases/update-account/update-account.use-case';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { CachedAccountRepository } from '@/modules/accounts/infrastructure/persistence/cached-account.repository';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveAccountUseCase } from './application/use-cases/archive-account/archive-account.use-case';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from './application/use-cases/list-accounts/list-accounts.use-case';
import { SetDefaultAccountUseCase } from './application/use-cases/set-default-account/set-default-account.use-case';
import { IAccountBalanceRepository } from './domain/repositories/account-balance.repository.interface';
import { IAccountRepository } from './domain/repositories/account.repository.interface';
import { AccountBalanceRepository } from './infrastructure/persistence/account-balance.repository';
import { AccountRepository } from './infrastructure/persistence/account.repository';
import { AccountsController } from './presentation/http/accounts.controller';
import { CreateDefaultAccountUseCase } from '@/modules/accounts/application/use-cases/create-default-account/create-default-account.use-case';
import { ProvisionDefaultAccountOnUserHandler } from '@/modules/accounts/application/handlers/provision-default-account-on-user.handler';

@Module({
  imports: [TypeOrmModule.forFeature([AccountOrmEntity])],
  controllers: [AccountsController],
  providers: [
    {
      provide: IAccountRepository,
      useClass: CachedAccountRepository,
    },
    {
      provide: IAccountBalanceRepository,
      useClass: AccountBalanceRepository,
    },
    AccountRepository,
    CreateAccountUseCase,
    ListAccountsUseCase,
    ArchiveAccountUseCase,
    SetDefaultAccountUseCase,
    UnarchiveAccountUseCase,
    UpdateAccountUseCase,
    CreateDefaultAccountUseCase,
    ProvisionDefaultAccountOnUserHandler,
  ],
  exports: [
    IAccountRepository,
    CreateAccountUseCase,
    ListAccountsUseCase,
    ArchiveAccountUseCase,
    SetDefaultAccountUseCase,
  ],
})
export class AccountsModule {}
