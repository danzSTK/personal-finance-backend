import { UserAvatarRemovedEvent } from '@/modules/users/domain/events/user-avatar-removed.event';
import { UserAvatarRemovedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-removed-event.rehydrator';

describe('UserAvatarRemovedEventHydrator', () => {
  it('rehydrates a persisted event payload', () => {
    const occurredAt = new Date('2026-06-22T12:00:00.000Z');
    const payload = {
      userId: '85423f76-b2e0-4499-8b94-da58b1df6f74',
      previousAssetId: '9e587d6d-dd96-4c74-ab06-6e6f11d4027d',
    };
    const hydrator = new UserAvatarRemovedEventHydrator();

    const event = hydrator.rehydrate({
      aggregateId: payload.userId,
      occurredAt,
      metadata: {},
      payload,
    });

    expect(event).toBeInstanceOf(UserAvatarRemovedEvent);
    expect(event.toPayload()).toEqual(payload);
    expect(event.occurredAt).toEqual(occurredAt);
  });
});
