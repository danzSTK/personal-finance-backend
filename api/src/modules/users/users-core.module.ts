import { AssetsModule } from '@/modules/assets/assets.module';
import { ObjectStorageModule } from '@/shared/object-storage';
import { OutboxModule } from '@/shared/outbox';
import { Module } from '@nestjs/common';
import { IAvatarImageProcessor } from './application/ports/avatar-image-processor.interface';
import { IImageFileTypeDetector } from './application/ports/image-file-type-detector.interface';
import { CheckUsernameAvailabilityUseCase } from './application/use-cases/check-username-availability/check-username.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user/create-user.use-case';
import { FindUserByEmailUseCase } from './application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { FindUserByUserNameUseCase } from './application/use-cases/find-by-user-name/find-by-user-name.use-case';
import { FindUserByIdUseCase } from './application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile/get-user-profile.use-case';
import { RemoveUserAvatarUseCase } from './application/use-cases/remove-user-avatar/remove-user-avatar.use-case';
import { UpdateUserAvatarUseCase } from './application/use-cases/update-user-avatar/update-user-avatar.use-case';
import { UpdateUserProfileUseCase } from './application/use-cases/update-user-profile/update-user-profile.use-case';
import { UpdateUsernameUseCase } from './application/use-cases/update-username/update-username.use-case';
import { FileTypeImageDetector } from './infrastructure/image-processing/file-type-image.detector';
import { SharpAvatarImageProcessor } from './infrastructure/image-processing/sharp-avatar.image.processor';
import { UsersPersistenceModule } from './users-persistence.module';

@Module({
  imports: [UsersPersistenceModule, AssetsModule, ObjectStorageModule, OutboxModule],
  providers: [
    { provide: IAvatarImageProcessor, useClass: SharpAvatarImageProcessor },
    { provide: IImageFileTypeDetector, useClass: FileTypeImageDetector },
    CheckUsernameAvailabilityUseCase,
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindUserByUserNameUseCase,
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    UpdateUserAvatarUseCase,
    RemoveUserAvatarUseCase,
    UpdateUsernameUseCase,
  ],
  exports: [
    UsersPersistenceModule,
    CheckUsernameAvailabilityUseCase,
    CreateUserUseCase,
    FindUserByIdUseCase,
    FindUserByEmailUseCase,
    FindUserByUserNameUseCase,
    GetUserProfileUseCase,
    UpdateUserProfileUseCase,
    UpdateUserAvatarUseCase,
    RemoveUserAvatarUseCase,
    UpdateUsernameUseCase,
  ],
})
export class UsersCoreModule {}
