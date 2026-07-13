import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveAccountUseCase } from './application/use-cases/archive-account/archive-account.use-case';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { CreateDefaultAccountUseCase } from './application/use-cases/create-default-account/create-default-account.use-case';
import { GetAccountSummaryUseCase } from './application/use-cases/get-account-summary/get-account-summary.use-case';
import { ListAccountsUseCase } from './application/use-cases/list-accounts/list-accounts.use-case';
import { SetDefaultAccountUseCase } from './application/use-cases/set-default-account/set-default-account.use-case';
import { UnarchiveAccountUseCase } from './application/use-cases/unarchive-account/unarchive-account.use-case';
import { UpdateAccountUseCase } from './application/use-cases/update-account/update-account.use-case';
import { IAccountBalanceRepository } from './domain/repositories/account-balance.repository.interface';
import { IAccountRepository } from './domain/repositories/account.repository.interface';
import { AccountBalanceRepository } from './infrastructure/persistence/account-balance.repository';
import { AccountOrmEntity } from './infrastructure/persistence/account.entity';
import { AccountRepository } from './infrastructure/persistence/account.repository';
import { CachedAccountRepository } from './infrastructure/persistence/cached-account.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AccountOrmEntity])],
  providers: [
    { provide: IAccountRepository, useClass: CachedAccountRepository },
    { provide: IAccountBalanceRepository, useClass: AccountBalanceRepository },
    AccountRepository,
    CreateAccountUseCase,
    ListAccountsUseCase,
    GetAccountSummaryUseCase,
    ArchiveAccountUseCase,
    SetDefaultAccountUseCase,
    UnarchiveAccountUseCase,
    UpdateAccountUseCase,
    CreateDefaultAccountUseCase,
  ],
  exports: [
    IAccountRepository,
    CreateAccountUseCase,
    ListAccountsUseCase,
    GetAccountSummaryUseCase,
    ArchiveAccountUseCase,
    SetDefaultAccountUseCase,
    UnarchiveAccountUseCase,
    UpdateAccountUseCase,
    CreateDefaultAccountUseCase,
  ],
})
export class AccountsCoreModule {}
