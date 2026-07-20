import { ObjectStorageModule } from '@/shared/object-storage/object-storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeleteAvatarAssetUseCase } from './application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { IAssetRepository } from './domain/repositories';
import { AssetOrmEntity } from './infrastructure/persistence/asset-orm.entity';
import { AssetRepository } from './infrastructure/persistence/asset.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AssetOrmEntity]), ObjectStorageModule],
  providers: [{ provide: IAssetRepository, useClass: AssetRepository }, DeleteAvatarAssetUseCase],
  exports: [IAssetRepository, DeleteAvatarAssetUseCase],
})
export class AssetsCoreModule {}
