import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([AssetOrmEntity])],
})
export class AssetsModule {}
