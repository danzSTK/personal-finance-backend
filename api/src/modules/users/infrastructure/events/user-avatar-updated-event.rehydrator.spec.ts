import { UserAvatarUpdatedEvent } from '@/modules/users/domain/events/user-avatar-updated.event';
import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';

describe('UserAvatarUpdatedEventHydrator', () => {
  it('rehydrates a persisted event payload', () => {
    const occurredAt = new Date('2026-06-22T12:00:00.000Z');
    const payload = {
      userId: '85423f76-b2e0-4499-8b94-da58b1df6f74',
      previousAssetId: '9e587d6d-dd96-4c74-ab06-6e6f11d4027d',
      currentAssetId: 'fe52a36f-5fc7-43ce-8827-52a6aa17d478',
    };
    const hydrator = new UserAvatarUpdatedEventHydrator();

    const event = hydrator.rehydrate({
      aggregateId: payload.userId,
      occurredAt,
      metadata: {},
      payload,
    });

    expect(event).toBeInstanceOf(UserAvatarUpdatedEvent);
    expect(event.toPayload()).toEqual(payload);
    expect(event.occurredAt).toEqual(occurredAt);
  });
});
