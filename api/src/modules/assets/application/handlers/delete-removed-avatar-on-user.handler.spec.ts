import { DeleteRemovedAvatarOnUserHandler } from '@/modules/assets/application/handlers/delete-removed-avatar-on-user.handler';
import { DeleteAvatarAssetUseCase } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { UserAvatarRemovedEvent } from '@/modules/users/domain/events/user-avatar-removed.event';

describe('DeleteRemovedAvatarOnUserHandler', () => {
  it('delegates cleanup of the removed avatar', async () => {
    const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
    const previousAssetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
    const execute = jest.fn();
    const useCase = { execute } as unknown as jest.Mocked<DeleteAvatarAssetUseCase>;
    const handler = new DeleteRemovedAvatarOnUserHandler(useCase);

    await handler.handle(UserAvatarRemovedEvent.create(userId, previousAssetId));

    expect(execute).toHaveBeenCalledWith({ userId, assetId: previousAssetId });
  });
});
