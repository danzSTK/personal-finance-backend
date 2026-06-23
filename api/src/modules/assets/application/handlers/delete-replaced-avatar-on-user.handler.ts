import { DeleteAvatarAssetUseCase } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { UserAvatarUpdatedEvent } from '@/modules/users/domain/events/user-avatar-updated.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class DeleteReplacedAvatarOnUserHandler {
  constructor(private readonly deleteAvatarAssetUseCase: DeleteAvatarAssetUseCase) {}

  @OnEvent(UserAvatarUpdatedEvent.eventName, { suppressErrors: false })
  async handle(event: UserAvatarUpdatedEvent): Promise<void> {
    if (!event.previousAssetId || event.previousAssetId === event.currentAssetId) {
      return;
    }

    await this.deleteAvatarAssetUseCase.execute({
      userId: event.userId,
      assetId: event.previousAssetId,
    });
  }
}
