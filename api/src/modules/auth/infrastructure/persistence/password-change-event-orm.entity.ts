import {
  PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH,
  PasswordChangeEventType,
} from '@/modules/auth/domain/constants/password-change.constants';
import type { PasswordChangeEventMetadata } from '@/modules/auth/domain/entities/password-change-event.entity';
import { AuthProviderOrmEntity } from '@/modules/users/infrastructure/persistence/auth-provider-orm.entity';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_change_events')
@Index('idx_password_change_events_user_type_occurred_at', ['userId', 'eventType', 'occurredAt'])
@Index('idx_password_change_events_auth_provider_id', ['authProviderId'])
@Check(
  'CHK_password_change_events_type',
  `"event_type" IN ('CURRENT_PASSWORD_FAILED', 'PASSWORD_CHANGED', 'FAILED_ATTEMPTS_BLOCK_STARTED')`,
)
@Check(
  'CHK_password_change_events_block',
  `(
    (
      "event_type" = 'FAILED_ATTEMPTS_BLOCK_STARTED'
      AND "blocked_until" IS NOT NULL
      AND "blocked_until" > "occurred_at"
    )
    OR
    (
      "event_type" <> 'FAILED_ATTEMPTS_BLOCK_STARTED'
      AND "blocked_until" IS NULL
    )
  )`,
)
@Check('CHK_password_change_events_metadata', `jsonb_typeof("metadata") = 'object'`)
export class PasswordChangeEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'auth_provider_id', type: 'uuid', nullable: true })
  authProviderId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType!: PasswordChangeEventType;

  @Column({ name: 'blocked_until', type: 'timestamptz', nullable: true })
  blockedUntil!: Date | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId!: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH,
    nullable: true,
  })
  userAgent!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: PasswordChangeEventMetadata;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_password_change_events_user',
  })
  user!: UserOrmEntity;

  @ManyToOne(() => AuthProviderOrmEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'auth_provider_id',
    foreignKeyConstraintName: 'FK_password_change_events_provider',
  })
  authProvider!: AuthProviderOrmEntity | null;
}
