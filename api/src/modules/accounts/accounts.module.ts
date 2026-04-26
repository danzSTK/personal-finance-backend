import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveAccountUseCase } from './application/use-cases/archive-account/archive-account.use-case';
import { CreateAccountUseCase } from './application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from './application/use-cases/list-accounts/list-accounts.use-case';
import { SetDefaultAccountUseCase } from './application/use-cases/set-default-account/set-default-account.use-case';
import { IAccountRepository } from './domain/repositories/account.repository.interface';
import { AccountRepository } from './infrastructure/persistence/account.repository';
import { AccountsController } from './presentation/http/accounts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountOrmEntity])],
  controllers: [AccountsController],
  providers: [
    {
      provide: IAccountRepository,
      useClass: AccountRepository,
    },
    AccountRepository,
    CreateAccountUseCase,
    ListAccountsUseCase,
    ArchiveAccountUseCase,
    SetDefaultAccountUseCase,
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
