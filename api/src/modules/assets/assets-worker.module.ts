import { AssetReconcilerService } from '@/modules/assets/application/services/asset-reconciler.service';
import { AssetsCoreModule } from '@/modules/assets/assets-core.module';
import { ObjectStorageModule } from '@/shared/object-storage/object-storage.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [AssetsCoreModule, ObjectStorageModule],
  providers: [AssetReconcilerService],
})
export class AssetsWorkerModule {}
