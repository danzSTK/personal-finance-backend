import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeEventMapper } from '@/modules/auth/infrastructure/mappers/password-change-event.mapper';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';
import { randomUUID } from 'node:crypto';

describe('PasswordChangeEventMapper', () => {
  describe('mapping', () => {
    it('round-trips all persisted fields without re-running creation validation', () => {
      const occurredAt = new Date('2026-07-30T12:00:00.000Z');
      const event = PasswordChangeEvent.currentPasswordFailed(
        {
          userId: randomUUID(),
          authProviderId: randomUUID(),
          sessionId: randomUUID(),
          ipAddress: '203.0.113.10',
          userAgent: 'Browser',
          metadata: {
            location: 'Fortaleza',
          },
          occurredAt,
        },
        randomUUID(),
      );

      const persistence = PasswordChangeEventMapper.toPersistence(event) as PasswordChangeEventOrmEntity;
      const restored = PasswordChangeEventMapper.toDomain(persistence);

      expect(restored.id).toBe(event.id);
      expect(restored.userId).toBe(event.userId);
      expect(restored.authProviderId).toBe(event.authProviderId);
      expect(restored.eventType).toBe(event.eventType);
      expect(restored.sessionId).toBe(event.sessionId);
      expect(restored.ipAddress).toBe(event.ipAddress);
      expect(restored.metadata).toEqual(event.metadata);
      expect(restored.occurredAt).toEqual(occurredAt);
    });
  });
});
