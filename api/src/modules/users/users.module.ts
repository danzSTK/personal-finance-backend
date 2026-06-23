import { AssetsModule } from '@/modules/assets/assets.module';
import { IAvatarImageProcessor } from '@/modules/users/application/ports/avatar-image-processor.interface';
import { IImageFileTypeDetector } from '@/modules/users/application/ports/image-file-type-detector.interface';
import { IUserCacheInvalidator } from '@/modules/users/application/ports/user-cache-invalidator.interface';
import { RemoveUserAvatarUseCase } from '@/modules/users/application/use-cases/remove-user-avatar/remove-user-avatar.use-case';
import { UpdateUserAvatarUseCase } from '@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case';
import { UpdateUserProfileUseCase } from '@/modules/users/application/use-cases/update-user-profile/update-user-profile.use-case';
import { RedisUserCacheInvalidator } from '@/modules/users/infrastructure/cache/redis-user-cache-invalidator';
import { FileTypeImageDetector } from '@/modules/users/infrastructure/image-processing/file-type-image.detector';
import { SharpAvatarImageProcessor } from '@/modules/users/infrastructure/image-processing/sharp-avatar.image.processor';
import { ObjectStorageModule } from '@/shared/object-storage';
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
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity, AuthProviderOrmEntity]),
    AssetsModule,
    ObjectStorageModule,
    OutboxModule,
  ],
  controllers: [UsersController],
  providers: [
    {
      provide: IUserRepository,
      useClass: CachedUserRepository,
    },
    {
      provide: IAvatarImageProcessor,
      useClass: SharpAvatarImageProcessor,
    },
    {
      provide: IImageFileTypeDetector,
      useClass: FileTypeImageDetector,
    },
    {
      provide: IUserCacheInvalidator,
      useClass: RedisUserCacheInvalidator,
    },
    UserRepository,
    CheckUsernameAvailabilityUseCase,
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindUserByUserNameUseCase,
    UpdateUserProfileUseCase,
    UpdateUserAvatarUseCase,
    RemoveUserAvatarUseCase,
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
