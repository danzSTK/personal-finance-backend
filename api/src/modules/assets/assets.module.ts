import { Module } from '@nestjs/common';
import { AssetsCoreModule } from './assets-core.module';

@Module({
  imports: [AssetsCoreModule],
  exports: [AssetsCoreModule],
})
export class AssetsModule {}
