import { DeleteReplacedAvatarOnUserHandler } from '@/modules/assets/application/handlers/delete-replaced-avatar-on-user.handler';
import { DeleteAvatarAssetUseCase } from '@/modules/assets/application/use-cases/delete-avatar-asset/delete-avatar-asset.use-case';
import { UserAvatarUpdatedEvent } from '@/modules/users/domain/events/user-avatar-updated.event';

describe('DeleteReplacedAvatarOnUserHandler', () => {
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  const currentAssetId = 'fe52a36f-5fc7-43ce-8827-52a6aa17d478';
  let useCase: jest.Mocked<DeleteAvatarAssetUseCase>;
  let execute: jest.Mock;
  let handler: DeleteReplacedAvatarOnUserHandler;

  beforeEach(() => {
    execute = jest.fn();
    useCase = { execute } as unknown as jest.Mocked<DeleteAvatarAssetUseCase>;
    handler = new DeleteReplacedAvatarOnUserHandler(useCase);
  });

  it('delegates cleanup of the previous avatar', async () => {
    const previousAssetId = '9e587d6d-dd96-4c74-ab06-6e6f11d4027d';
    const event = UserAvatarUpdatedEvent.create(userId, previousAssetId, currentAssetId);

    await handler.handle(event);

    expect(execute).toHaveBeenCalledWith({ userId, assetId: previousAssetId });
  });

  it('does nothing on the first avatar', async () => {
    const event = UserAvatarUpdatedEvent.create(userId, null, currentAssetId);

    await handler.handle(event);

    expect(execute).not.toHaveBeenCalled();
  });
});
