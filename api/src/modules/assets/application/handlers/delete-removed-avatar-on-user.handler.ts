import { DeleteAvatarAssetUseCase } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { UserAvatarRemovedEvent } from '@/modules/users/domain/events/user-avatar-removed.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class DeleteRemovedAvatarOnUserHandler {
  constructor(private readonly deleteAvatarAssetUseCase: DeleteAvatarAssetUseCase) {}

  @OnEvent(UserAvatarRemovedEvent.eventName, { suppressErrors: false })
  async handle(event: UserAvatarRemovedEvent): Promise<void> {
    await this.deleteAvatarAssetUseCase.execute({
      userId: event.userId,
      assetId: event.previousAssetId,
    });
  }
}
