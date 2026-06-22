import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { ObjectStorageModule } from '@/shared/object-storage/object-storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([AssetOrmEntity]), ObjectStorageModule],
})
export class AssetsModule {}
