import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';

export class PasswordChangeEventMapper {
  static toDomain(entity: PasswordChangeEventOrmEntity): PasswordChangeEvent {
    return PasswordChangeEvent.reconstitute(
      {
        userId: entity.userId,
        authProviderId: entity.authProviderId,
        eventType: entity.eventType,
        blockedUntil: entity.blockedUntil,
        sessionId: entity.sessionId,
        ipAddress: entity.ipAddress,
        userAgent: entity.userAgent,
        metadata: { ...entity.metadata },
        occurredAt: entity.occurredAt,
        createdAt: entity.createdAt,
      },
      entity.id,
    );
  }

  static toPersistence(event: PasswordChangeEvent): Partial<PasswordChangeEventOrmEntity> {
    return {
      id: event.id,
      userId: event.userId,
      authProviderId: event.authProviderId,
      eventType: event.eventType,
      blockedUntil: event.blockedUntil,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: { ...event.metadata },
      occurredAt: event.occurredAt,
      createdAt: event.createdAt,
    };
  }
}
