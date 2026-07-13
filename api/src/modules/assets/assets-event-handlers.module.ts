import { Module } from '@nestjs/common';
import { DeleteRemovedAvatarOnUserHandler } from './application/handlers/delete-removed-avatar-on-user.handler';
import { DeleteReplacedAvatarOnUserHandler } from './application/handlers/delete-replaced-avatar-on-user.handler';
import { AssetsCoreModule } from './assets-core.module';

@Module({
  imports: [AssetsCoreModule],
  providers: [DeleteReplacedAvatarOnUserHandler, DeleteRemovedAvatarOnUserHandler],
})
export class AssetsEventHandlersModule {}
