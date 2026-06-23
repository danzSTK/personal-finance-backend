import { DeleteReplacedAvatarOnUserHandler } from '@/modules/assets/application/handlers/delete-replaced-avatar-on-user.handler';
import { DeleteRemovedAvatarOnUserHandler } from '@/modules/assets/application/handlers/delete-removed-avatar-on-user.handler';
import { DeleteAvatarAssetUseCase } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { IAssetRepository } from '@/modules/assets/domain/repositories';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { AssetRepository } from '@/modules/assets/infrastructure/persistence/asset.repository';
import { ObjectStorageModule } from '@/shared/object-storage/object-storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([AssetOrmEntity]), ObjectStorageModule],
  providers: [
    {
      provide: IAssetRepository,
      useClass: AssetRepository,
    },
    DeleteAvatarAssetUseCase,
    DeleteReplacedAvatarOnUserHandler,
    DeleteRemovedAvatarOnUserHandler,
  ],
  exports: [IAssetRepository],
})
export class AssetsModule {}
