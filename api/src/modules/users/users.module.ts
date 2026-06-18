import { UpdateUserProfileUseCase } from '@/modules/users/application/use-cases/update-user-profile/update-user-profile.use-case';
import { OutboxModule } from '@/shared/outbox';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckUsernameAvailabilityUseCase } from './application/use-cases/check-username-availability/check-username.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { FindUserByEmailUseCase } from './application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { FindUserByUserNameUseCase } from './application/use-cases/find-by-user-name/find-by-user-name.use-case';
import { FindUserByIdUseCase } from './application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { IUserRepository } from './domain/repositories/user.respository.interface';
import { AuthProviderOrmEntity } from './infrastructure/persistence/auth-provider-orm.entity';
import { CachedUserRepository } from './infrastructure/persistence/cached-user.repository';
import { UserOrmEntity } from './infrastructure/persistence/user-orm-entity';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { UsersController } from './presentation/http/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, AuthProviderOrmEntity]), OutboxModule],
  controllers: [UsersController],
  providers: [
    {
      provide: IUserRepository,
      useClass: CachedUserRepository,
    },
    UserRepository,
    CheckUsernameAvailabilityUseCase,
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindUserByUserNameUseCase,
    UpdateUserProfileUseCase,
  ],
  exports: [
    IUserRepository,
    CheckUsernameAvailabilityUseCase,
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindUserByUserNameUseCase,
  ],
})
export class UsersModule {}
