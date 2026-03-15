import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from './infrastructure/persistence/user-orm-entity';
import { UsersController } from './presentation/http/users.controller';
import { IUserRepository } from './domain/repositories/user.respository.interface';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { FindUserByIdUseCase } from './application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { FindUserByEmailUseCase } from './application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { FindUserByUserNameUseCase } from './application/use-cases/find-by-user-name/find-by-user-name.use-case';
import { AuthProviderOrmEntity } from './infrastructure/persistence/auth-provider-orm.entity';
import { CachedUserRepository } from './infrastructure/persistence/cached-user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, AuthProviderOrmEntity])],
  controllers: [UsersController],
  providers: [
    {
      provide: IUserRepository,
      useClass: CachedUserRepository,
    },
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindUserByUserNameUseCase,
  ],
  exports: [IUserRepository, CreateUserUseCase, FindUserByIdUseCase, FindUserByEmailUseCase, FindUserByUserNameUseCase],
})
export class UsersModule {}
