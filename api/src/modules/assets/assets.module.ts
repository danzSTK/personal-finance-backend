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
  ],
  exports: [IAssetRepository],
})
export class AssetsModule {}
